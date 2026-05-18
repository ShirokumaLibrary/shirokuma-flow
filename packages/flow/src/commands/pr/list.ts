/**
 * PR list subcommand - List pull requests
 *
 * Fetches and displays a list of PRs filtered by state.
 */

import { Logger } from "../../utils/logger.js";
import { runGraphQL } from "../../utils/github.js";
import { formatOutput, GH_PR_LIST_COLUMNS } from "../../utils/formatters.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import {
  parsePrStateFilter,
  GRAPHQL_QUERY_PR_LIST,
  resolvePrFromHeadWithDetails,
} from "./helpers.js";
import type { IssuesPrOptions, PrListNode, PrListQueryResult } from "./types.js";

// =============================================================================
// cmdPrList (#568 — PR 一覧表示)
// =============================================================================

export async function cmdPrList(
  options: IssuesPrOptions,
  logger: Logger
): Promise<number> {
  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;
  const limit = options.limit ?? 10;
  const stateInput = options.state ?? "open";
  const headBranch = options.head;

  // --head オプション: ブランチから PR を逆引きして単一 PR を返す
  // REST API のレスポンスを直接使うため GraphQL 呼び出し不要
  if (headBranch) {
    const prDetails = await resolvePrFromHeadWithDetails(headBranch, owner, repo, logger);
    if (prDetails === null) {
      return 1;
    }

    const prs = [prDetails];
    const output = {
      repository: `${owner}/${repo}`,
      pull_requests: prs,
      total_count: prs.length,
    };

    const outputFormat = options.format ?? "table-json";
    const formatted = formatOutput(output, outputFormat, {
      arrayKey: "pull_requests",
      columns: GH_PR_LIST_COLUMNS,
    });
    console.log(formatted);
    return 0;
  }

  const states = parsePrStateFilter(stateInput);
  if (!states) {
    logger.error(`Invalid state: "${stateInput}". Use: open, closed, merged, all`);
    return 1;
  }

  const result = await runGraphQL<PrListQueryResult>(GRAPHQL_QUERY_PR_LIST, {
    owner,
    name: repo,
    first: limit,
    states,
  });

  if (!result.success) {
    logger.error("Failed to fetch pull requests");
    return 1;
  }

  const nodes = result.data?.data?.repository?.pullRequests?.nodes ?? [];

  const prs = nodes
    .filter((n): n is PrListNode & { number: number } => !!n?.number)
    .map((n) => ({
      number: n.number,
      title: n.title ?? "",
      state: n.state ?? "OPEN",
      head_branch: n.headRefName ?? "",
      base_branch: n.baseRefName ?? "",
      author: n.author?.login ?? "",
      review_decision: n.reviewDecision ?? null,
      url: n.url ?? "",
    }));

  const output = {
    repository: `${owner}/${repo}`,
    pull_requests: prs,
    total_count: prs.length,
  };

  const outputFormat = options.format ?? "table-json";
  const formatted = formatOutput(output, outputFormat, {
    arrayKey: "pull_requests",
    columns: GH_PR_LIST_COLUMNS,
  });
  console.log(formatted);
  return 0;
}
