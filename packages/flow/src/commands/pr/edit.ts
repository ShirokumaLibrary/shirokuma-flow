/**
 * PR edit サブコマンド - PR のメタデータを更新する (#2119)
 *
 * --base でベースブランチ、--title でタイトル、positional [body-file] で本文を変更できる。
 * 少なくとも1つのオプションが必要。
 */

import { Logger } from "../../utils/logger.js";
import { isIssueNumber, parseIssueNumber } from "../../utils/github.js";
import { getOctokit } from "../../utils/octokit-client.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import { dryRunPreview } from "../../utils/dry-run.js";
import { fetchAndCachePr } from "../issue/pull/pr.js";
import type { IssuesPrOptions } from "./types.js";

// =============================================================================
// cmdPrEdit (#2119)
// =============================================================================

export async function cmdPrEdit(
  prNumberStr: string,
  options: IssuesPrOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(prNumberStr)) {
    logger.error(`Invalid PR number: ${prNumberStr}`);
    return 1;
  }

  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;
  const prNumber = parseIssueNumber(prNumberStr);

  const hasBase = options.base !== undefined;
  const hasTitle = options.title !== undefined;
  const hasBody = options.bodyFile !== undefined;

  if (!hasBase && !hasTitle && !hasBody) {
    logger.error("更新するフィールドを1つ以上指定してください (--base / --title / positional [body-file])");
    return 1;
  }

  // --dry-run: API を呼ばずパラメータをプレビュー
  if (options.dryRun) {
    return dryRunPreview({
      command: "pr",
      operation: "edit",
      params: {
        repository: `${owner}/${repo}`,
        pull_number: prNumber,
        base: hasBase ? options.base : undefined,
        title: hasTitle ? options.title : undefined,
        body: hasBody ? "(body content)" : undefined,
      },
    }, logger);
  }

  const octokit = getOctokit();

  const updateParams: {
    owner: string;
    repo: string;
    pull_number: number;
    base?: string;
    title?: string;
    body?: string;
  } = { owner, repo, pull_number: prNumber };

  if (hasBase) updateParams.base = options.base;
  if (hasTitle) updateParams.title = options.title;
  if (hasBody) updateParams.body = options.bodyFile;

  let updatedPr: {
    number: number;
    title: string;
    html_url: string;
    base: { ref: string };
  };

  try {
    const { data } = await octokit.rest.pulls.update(updateParams);
    updatedPr = data as typeof updatedPr;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to update PR #${prNumber}: ${errorMsg}`);
    return 1;
  }

  logger.success(`Updated PR #${prNumber}`);

  // ローカルキャッシュを同期（best-effort）
  try {
    await fetchAndCachePr(owner, repo, prNumber, owner, undefined, logger);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`PR #${prNumber} のキャッシュ同期をスキップ: ${msg}`);
  }

  const output = {
    number: updatedPr.number,
    title: updatedPr.title,
    url: updatedPr.html_url,
    base_branch: updatedPr.base.ref,
  };

  console.log(JSON.stringify(output, null, 2));
  return 0;
}
