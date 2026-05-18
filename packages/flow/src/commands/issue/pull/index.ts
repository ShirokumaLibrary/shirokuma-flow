/**
 * items pull サブコマンド (#1808)
 *
 * GitHub から Issue / Discussion の本体とコメントを取得し、
 * `.shirokuma/github/` にキャッシュとして書き込む。
 *
 * アイテム種別は自動判別（Issue → Discussion の順で検索）。
 * Projects フィールド（status/priority/size/labels/title）も frontmatter に含める。
 */

import { parseIssueNumber, isIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { upsertOpenIssuesEntry, GITHUB_CACHE_DIR } from "../../../utils/github-cache.js";
import type { Logger } from "../../../utils/logger.js";
import type { PullOptions } from "../../items/types.js";
import { fetchAndCacheIssue } from "./issue.js";
import { fetchAndCacheDiscussion } from "./discussion.js";
import { fetchAndCachePr } from "./pr.js";

// =============================================================================
// コマンドエントリポイント
// =============================================================================

/**
 * items pull サブコマンド
 *
 * GitHub から指定番号の Issue または Discussion を取得してキャッシュに書き込む。
 * 種別は自動判別（Issue → Discussion の順で検索）。
 */
export async function cmdPull(
  numberStr: string,
  options: PullOptions,
  logger: Logger
): Promise<number> {
  // #2024 Phase 4: 非推奨警告
  logger.warn("⚠ 'items pull' は非推奨です。代わりに 'items context' を使用してください。");

  if (!isIssueNumber(numberStr)) {
    logger.error("Valid item number required");
    return 1;
  }

  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;
  const number = parseIssueNumber(numberStr);
  const baseDir = options.dir;

  // PR → Issue → Discussion の順で取得を試みる
  const prSnapshot = await fetchAndCachePr(owner, repo, number, owner, baseDir, logger);
  if (prSnapshot) {
    upsertOpenIssuesEntry({
      number, type: "pull_request", title: prSnapshot.title,
      status: prSnapshot.status, priority: prSnapshot.priority, size: prSnapshot.size,
    }, owner, repo, baseDir ?? GITHUB_CACHE_DIR);
    logger.success(`PR #${number} をキャッシュしました`);
    console.log(JSON.stringify({
      number,
      type: "pull_request",
      title: prSnapshot.title,
      cached: true,
    }, null, 2));
    return 0;
  }

  const issueSnapshot = await fetchAndCacheIssue(owner, repo, number, owner, baseDir, logger);
  if (issueSnapshot) {
    upsertOpenIssuesEntry({
      number, type: "issue", title: issueSnapshot.title,
      status: issueSnapshot.status, priority: issueSnapshot.priority, size: issueSnapshot.size,
    }, owner, repo, baseDir ?? GITHUB_CACHE_DIR);
    logger.success(`Issue #${number} をキャッシュしました`);
    console.log(JSON.stringify({
      number,
      type: "issue",
      title: issueSnapshot.title,
      cached: true,
    }, null, 2));
    return 0;
  }

  // Issue が見つからなければ Discussion として取得を試みる
  const discussionSnapshot = await fetchAndCacheDiscussion(owner, repo, number, owner, baseDir, logger);
  if (discussionSnapshot) {
    logger.success(`Discussion #${number} をキャッシュしました`);
    console.log(JSON.stringify({
      number,
      type: "discussion",
      title: discussionSnapshot.title,
      cached: true,
    }, null, 2));
    return 0;
  }

  logger.error(`#${number} は PR でも Issue でも Discussion でも見つかりませんでした`);
  return 1;
}

// =============================================================================
// Re-exports（後方互換維持）
// =============================================================================

export { fetchAndCacheIssue } from "./issue.js";
export { fetchAndCacheDiscussion } from "./discussion.js";
export { fetchAndCachePr } from "./pr.js";
export { fetchRemoteSnapshot } from "./snapshot.js";
