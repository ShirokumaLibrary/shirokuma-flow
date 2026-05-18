/**
 * items check サブコマンド (#1808)
 *
 * ローカルキャッシュとリモートの状態を比較し、差分サマリーを表示する。
 * 実際の更新は行わない（push コマンドが担当）。
 *
 * 比較対象フィールド:
 * - body: 本文
 * - title: タイトル
 * - status: Projects Status フィールド（Issue のみ）
 * - priority: Projects Priority フィールド（Issue のみ）
 * - size: Projects Size フィールド（Issue のみ）
 * - labels: ラベル（Issue のみ）
 */

import {
  isIssueNumber,
  parseIssueNumber,
} from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { probeReadCache, GITHUB_CACHE_DIR, TYPE_DIR_MAP } from "../../../utils/github-cache.js";
import { listFiles } from "../../../utils/file.js";
import { fetchRemoteSnapshot } from "../pull/snapshot.js";
import { compareSnapshots } from "./compare.js";
import type { Logger } from "../../../utils/logger.js";
import type { CheckOptions, CheckResult } from "../../items/types.js";
import { join } from "node:path";
import { existsSync } from "node:fs";

/** ディレクトリ名の一覧 */
const TYPE_DIRS = ["issues", "pulls", "discussions"] as const;
/** ディレクトリ名 → type の逆マッピング */
const DIR_TO_TYPE: Record<string, "issue" | "pull_request" | "discussion"> = {
  issues: "issue",
  pulls: "pull_request",
  discussions: "discussion",
};

// =============================================================================
// コマンドエントリポイント
// =============================================================================

/**
 * items check サブコマンド
 *
 * 番号が指定された場合は単一アイテムをチェック。
 * 番号が省略された場合はキャッシュディレクトリ内の全アイテムをチェック。
 */
export async function cmdCheck(
  numberStr: string | undefined,
  options: CheckOptions,
  logger: Logger
): Promise<number> {
  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;
  const baseDir = options.dir ?? GITHUB_CACHE_DIR;

  if (numberStr !== undefined) {
    // 単一アイテムのチェック
    if (!isIssueNumber(numberStr)) {
      logger.error("Valid item number required");
      return 1;
    }

    const number = parseIssueNumber(numberStr);
    const result = await checkSingleItem(owner, repo, number, baseDir, logger);
    console.log(JSON.stringify(result, null, 2));
    return result.changed ? 1 : 0;
  }

  // キャッシュディレクトリ内の全アイテムをチェック
  return checkAllItems(owner, repo, baseDir, logger);
}

// =============================================================================
// 単一アイテムのチェック
// =============================================================================

/**
 * 単一アイテムのチェック
 */
export async function checkSingleItem(
  owner: string,
  repo: string,
  number: number,
  baseDir: string,
  logger: Logger
): Promise<CheckResult> {
  const cached = probeReadCache(number, owner, repo, baseDir);
  const foundType = cached?.metadata.type ?? "issue";
  const typeDir = TYPE_DIR_MAP[foundType];
  const cacheFilePath = join(baseDir, owner, repo, typeDir, `${number}`, "body.md");

  if (!cached) {
    logger.warn(`#${number} のキャッシュが見つかりません`);
    return {
      number,
      type: "issue",
      changed: false,
      diffs: [{ field: "cache", local: null, remote: "(not cached)" }],
      cache_file: cacheFilePath,
    };
  }

  const { metadata: localMeta, body: localBody } = cached;

  // PR キャッシュは check 未対応（PR の差分比較は不要なため）
  if (localMeta.type === "pull_request") {
    logger.info(`#${number} は PR のため check をスキップします`);
    return {
      number,
      type: "pull_request" as const,
      changed: false,
      diffs: [],
      cache_file: cacheFilePath,
    };
  }

  const type = localMeta.type === "discussion" ? "discussion" : "issue";

  // リモートから最新状態をキャッシュ書き込みなしで取得（差分比較のみが目的）
  const remoteSnapshot = await fetchRemoteSnapshot(owner, repo, number, type);

  if (!remoteSnapshot) {
    logger.warn(`#${number} のリモートデータを取得できませんでした`);
    return {
      number,
      type,
      changed: false,
      diffs: [{ field: "remote", local: null, remote: "(fetch failed)" }],
      cache_file: cacheFilePath,
    };
  }

  // 差分を比較
  const diffs = compareSnapshots(
    localMeta,
    localBody,
    remoteSnapshot.title,
    remoteSnapshot.body,
    remoteSnapshot.status,
    remoteSnapshot.priority,
    remoteSnapshot.size,
    remoteSnapshot.labels
  );

  return {
    number,
    type,
    changed: diffs.length > 0,
    diffs,
    cache_file: cacheFilePath,
  };
}

// =============================================================================
// 全アイテムのチェック
// =============================================================================

/**
 * キャッシュディレクトリ内の全アイテムをチェック
 */
export async function checkAllItems(
  owner: string,
  repo: string,
  baseDir: string,
  logger: Logger
): Promise<number> {
  // 新ディレクトリ構造: {baseDir}/{owner}/{repo}/{typeDir}/{number}/body.md
  const repoDir = join(baseDir, owner, repo);
  if (!existsSync(repoDir)) {
    logger.warn(`キャッシュディレクトリが見つかりません: ${repoDir}`);
    console.log(JSON.stringify({ results: [], total: 0, changed: 0 }, null, 2));
    return 0;
  }

  // {typeDir}/{number}/body.md 形式のファイルを列挙
  const numbersWithType: Array<{ number: number; type: "issue" | "pull_request" | "discussion" }> = [];
  for (const typeDir of TYPE_DIRS) {
    const dirPath = join(repoDir, typeDir);
    if (!existsSync(dirPath)) continue;

    let files: string[] = [];
    try {
      files = listFiles(dirPath, { extensions: [".md"], recursive: true });
    } catch {
      continue;
    }

    for (const filePath of files) {
      // body.md のみを対象（コメントファイルは除外）
      if (!filePath.endsWith("body.md")) continue;
      const match = filePath.match(/[/\\](\d+)[/\\]body\.md$/);
      if (match) {
        numbersWithType.push({
          number: parseInt(match[1], 10),
          type: DIR_TO_TYPE[typeDir],
        });
      }
    }
  }

  // 番号でソート
  numbersWithType.sort((a, b) => a.number - b.number);

  if (numbersWithType.length === 0) {
    logger.info("キャッシュにアイテムが見つかりません");
    console.log(JSON.stringify({ results: [], total: 0, changed: 0 }, null, 2));
    return 0;
  }

  logger.info(`${numbersWithType.length} 件のキャッシュアイテムをチェックします...`);

  const results: CheckResult[] = [];
  for (const { number } of numbersWithType) {
    const result = await checkSingleItem(owner, repo, number, baseDir, logger);
    results.push(result);
    if (result.changed) {
      logger.warn(`#${number}: ${result.diffs.length} 件の差分`);
    } else {
      logger.info(`#${number}: 差分なし`);
    }
  }

  const changedCount = results.filter((r) => r.changed).length;

  console.log(JSON.stringify({
    results,
    total: results.length,
    changed: changedCount,
  }, null, 2));

  return changedCount > 0 ? 1 : 0;
}
