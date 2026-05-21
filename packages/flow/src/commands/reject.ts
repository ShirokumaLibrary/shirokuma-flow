/**
 * reject <number> --reason <text> --rollback — Review からの差し戻し checkpoint
 *
 * 動的ルーティング（ADR-v3-022 #2531）:
 * - issue: Review → Backlog（計画 Issue 子のレビュー差し戻し）
 * - pr:    Review → In progress（PR コードレビュー差し戻し）
 *
 * --rollback 必須（ロールバック遷移のため明示）。--reason は必須で Issue コメントとして自動記録される。
 *
 * @since #2532 --rollback 必須化・動的ルーティング対応
 */

// Commander.js action callbacks receive opts as any; types are cast at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import {
  createActionLogger,
  setExitCode,
} from "../utils/cli-helpers.js";
import { isIssueNumber } from "../utils/github.js";
import { resolveTargetRepo } from "../utils/repo-pairs.js";
import { STATUS_VALUES } from "../utils/status-workflow.js";
import type { Logger } from "../utils/logger.js";
import type { ItemsOptions } from "./items/types.js";
import { resolveCurrentStatus } from "./status/shared/resolve-status.js";

// =============================================================================
// オプション型
// =============================================================================

export interface RejectOptions extends ItemsOptions {
  /** 差し戻し理由（必須）。Issue コメントとして自動記録される */
  reason?: string;
  /** 強制遷移（status transition --force と同等） */
  force?: boolean;
  /**
   * ロールバック遷移フラグ（必須）。
   * reject は常にロールバック遷移であるため、このフラグを明示する必要がある。
   * ADR-v3-022 第二改訂版 #2531
   */
  rollback?: boolean;
  /** キャッシュを使わずライブから現在ステータスを再取得しキャッシュを更新する（#2683） */
  refresh?: boolean;
}

// =============================================================================
// 実装
// =============================================================================

export async function cmdReject(
  numberStr: string,
  options: RejectOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(numberStr)) {
    logger.error("有効な Issue 番号を指定してください");
    return 1;
  }

  if (!options.reason?.trim()) {
    logger.error(
      "--reason オプションは必須です（例: --reason \"テストカバレッジが不足しているため再実装が必要\"）",
    );
    return 2;
  }

  // --rollback フラグ必須チェック（ADR-v3-022 第二改訂版）
  if (!options.rollback) {
    logger.error(
      "--rollback フラグが必須です。reject はロールバック遷移（Review → Backlog / Review → In progress）であるため、明示的に --rollback を指定してください",
    );
    return 2;
  }

  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("リポジトリを特定できません");
    return 1;
  }
  const { owner, name: repo } = repoInfo;
  const number = parseInt(numberStr, 10);

  const { status: fromStatus, isPr } = await resolveCurrentStatus(owner, repo, number, logger, {
    refresh: options.refresh,
  });
  const itemType: "issue" | "pr" = isPr ? "pr" : "issue";

  if (fromStatus !== null && fromStatus !== STATUS_VALUES.REVIEW) {
    logger.error(
      `reject: ${itemType} の現在ステータスは ${fromStatus} です。reject は Review ステータスからのみ実行できます`,
    );
    return 1;
  }

  const toStatus = isPr ? STATUS_VALUES.IN_PROGRESS : STATUS_VALUES.BACKLOG;
  logger.info(
    isPr
      ? "reject: pr → In progress（PR コードレビュー差し戻し）"
      : "reject: issue → Backlog（計画 Issue 子のレビュー差し戻し）",
  );

  // Step 1: コメント投稿（reason を本文化）
  // tmpfile に書き出して issue comment <file> (positional) 経由で投稿する
  const commentBody = `## 差し戻し理由\n\n${options.reason.trim()}\n`;
  const tmpFile = join(tmpdir(), `shirokuma-flow-reject-${numberStr}-${Date.now()}.md`);
  await fs.mkdir(tmpdir(), { recursive: true });
  await fs.writeFile(tmpFile, commentBody, "utf8");

  try {
    const { cmdAddComment } = await import("./issue/comment/index.js");
    // reject 固有のプロパティは cmdAddComment の AddCommentOptions に存在しないため除外する
    const { reason: _reason, force: _force, rollback: _rollback, ...passthroughOptions } = options;
    const commentCode = await cmdAddComment(
      numberStr,
      tmpFile,
      passthroughOptions,
      logger,
    );
    if (commentCode !== 0) {
      logger.error(
        "コメント投稿に失敗したためステータス遷移を中止しました。コメント内容を見直して再実行してください。",
      );
      return commentCode;
    }
  } finally {
    await fs.unlink(tmpFile).catch(() => undefined);
  }

  // Step 2: status transition --to {toStatus} --rollback（ロールバック遷移）
  const { cmdItemTransition } = await import("./status/transition/index.js");
  return await cmdItemTransition(
    numberStr,
    { ...options, to: toStatus, rollback: true, force: options.force, refresh: options.refresh },
    logger,
  );
}

// =============================================================================
// Factory
// =============================================================================

export function createRejectCommand(): Command {
  return new Command("reject")
    .description(
      "Issue/PR を Review からレビュー差し戻しする。" +
        " --rollback 必須（ADR-v3-022 第二改訂版: issue → Backlog、pr → In progress）。" +
        " --reason は必須で、自動的に Issue コメントとして記録される",
    )
    .argument("<number>", "Issue/PR 番号")
    .requiredOption("--reason <text>", "差し戻し理由 (必須)")
    .requiredOption("--rollback", "ロールバック遷移フラグ（必須: reject は常にロールバック遷移）")
    .option("--force", "ステータス遷移ルールを無視して強制遷移")
    .option("--refresh", "キャッシュを使わずライブから現在ステータスを再取得しキャッシュを更新する")
    .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
    .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
    .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
    .option("-v, --verbose", "詳細ログ出力")
    .action(async (number, localOpts) => {
      const logger = createActionLogger(localOpts);
      setExitCode(await cmdReject(number, localOpts, logger));
    });
}
