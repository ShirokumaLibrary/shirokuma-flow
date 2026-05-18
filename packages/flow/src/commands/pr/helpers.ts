/**
 * PR command helpers
 *
 * Pure/helper functions for the pr command and its subcommands.
 */

import { Logger } from "../../utils/logger.js";
import { runGraphQL } from "../../utils/github.js";
import { getOctokit } from "../../utils/octokit-client.js";
import type {
  PrSummary,
  PrListNode,
  PrListQueryResult,
  LinkPattern,
  LinkGraphEntry,
} from "./types.js";

// =============================================================================
// Pure validation functions (exported for testing)
// =============================================================================

/**
 * Validate that at most one merge method is specified.
 * Returns error message or null if valid.
 */
export function validateMergeMethod(options: {
  squash?: boolean;
  merge?: boolean;
  rebase?: boolean;
}): string | null {
  const methods = [options.squash, options.merge, options.rebase].filter(Boolean);
  if (methods.length > 1) {
    return "Only one merge method can be specified (--squash, --merge, or --rebase)";
  }
  return null;
}

/**
 * Determine the merge method from options. Defaults to "squash".
 */
export function parseMergeMethod(options: {
  squash?: boolean;
  merge?: boolean;
  rebase?: boolean;
}): "squash" | "merge" | "rebase" {
  if (options.merge) return "merge";
  if (options.rebase) return "rebase";
  return "squash";
}

/**
 * Parse linked issue numbers from PR body text.
 * Looks for patterns: Closes #N, Fixes #N, Resolves #N (case-insensitive).
 * Returns deduplicated array of issue numbers.
 */
export function parseLinkedIssues(body: string | undefined | null): number[] {
  if (!body) return [];

  const pattern = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
  const numbers = new Set<number>();

  let match;
  while ((match = pattern.exec(body)) !== null) {
    numbers.add(parseInt(match[1], 10));
  }

  return [...numbers];
}

/**
 * Detect the PR-Issue link pattern from a mapping of issues to their linked PRs.
 * Pure function (no API calls) — exported for testing.
 *
 * @param linkedIssues - Issue numbers linked by the current PR
 * @param issueToAllPrs - Map of issue number → all PR numbers that reference it with closing keywords
 */
export function detectLinkPattern(
  linkedIssues: number[],
  issueToAllPrs: Map<number, number[]>
): LinkPattern {
  if (linkedIssues.length === 0) return "1:1";

  const allPrs = new Set<number>();
  for (const prs of issueToAllPrs.values()) {
    for (const pr of prs) allPrs.add(pr);
  }

  const multipleIssues = linkedIssues.length > 1;
  const multiplePrs = allPrs.size > 1;

  if (!multipleIssues && !multiplePrs) return "1:1";
  if (multipleIssues && !multiplePrs) return "1:N";
  if (!multipleIssues && multiplePrs) return "N:1";
  return "N:N";
}

/**
 * Build a link graph for the given PR by searching for other open PRs
 * that also reference the same issues with closing keywords.
 *
 * Uses GitHub Search API to find open PRs mentioning each issue,
 * then verifies with parseLinkedIssues for precision.
 */
export async function buildLinkGraph(
  owner: string,
  repo: string,
  currentPr: number,
  linkedIssues: number[],
  logger: Logger
): Promise<{ pattern: LinkPattern; entries: LinkGraphEntry[] }> {
  const octokit = getOctokit();
  const issueToAllPrs = new Map<number, number[]>();

  for (const issueNum of linkedIssues) {
    try {
      const { data } = await octokit.rest.search.issuesAndPullRequests({
        q: `repo:${owner}/${repo} is:pr is:open "#${issueNum}"`,
        per_page: 30,
      });

      // Filter: only PRs that actually have closing keywords for this issue
      const prs = data.items
        .filter((item) => {
          const linked = parseLinkedIssues(item.body ?? undefined);
          return linked.includes(issueNum);
        })
        .map((item) => item.number);

      // Ensure current PR is included (it may already be in search results)
      if (!prs.includes(currentPr)) {
        prs.push(currentPr);
      }

      issueToAllPrs.set(issueNum, prs);
    } catch {
      // Best-effort: if search fails, assume only this PR
      logger.debug(`Search failed for issue #${issueNum}, assuming single PR`);
      issueToAllPrs.set(issueNum, [currentPr]);
    }
  }

  const pattern = detectLinkPattern(linkedIssues, issueToAllPrs);
  const entries: LinkGraphEntry[] = [...issueToAllPrs.entries()].map(
    ([issueNumber, linkedPrs]) => ({ issueNumber, linkedPrs })
  );

  return { pattern, entries };
}

// =============================================================================
// PR 一覧取得クエリ（#568 — pr-list + fetchOpenPRs 共通）
// =============================================================================

export const GRAPHQL_QUERY_PR_LIST = `
query($owner: String!, $name: String!, $first: Int!, $states: [PullRequestState!]) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: $first, states: $states, orderBy: {field: CREATED_AT, direction: DESC}) {
      nodes {
        number
        title
        state
        url
        headRefName
        baseRefName
        author { login }
        reviewDecision
        reviewThreads(first: 0) { totalCount }
        reviews(first: 0) { totalCount }
      }
    }
  }
}
`;

// =============================================================================
// parsePrStateFilter (#568 — --state オプションの GraphQL enum 変換)
// =============================================================================

/**
 * --state オプション値を GraphQL PullRequestState enum 配列に変換する。
 * 無効な値の場合は null を返す。
 */
export function parsePrStateFilter(
  state: string
): ("OPEN" | "CLOSED" | "MERGED")[] | null {
  switch (state.toLowerCase()) {
    case "open":
      return ["OPEN"];
    case "closed":
      return ["CLOSED"];
    case "merged":
      return ["MERGED"];
    case "all":
      return ["OPEN", "CLOSED", "MERGED"];
    default:
      return null;
  }
}

// =============================================================================
// fetchOpenPRs (#45 - shared helper for session start)
// =============================================================================

export async function fetchOpenPRs(
  owner: string,
  repo: string,
  limit: number = 10
): Promise<PrSummary[]> {
  const result = await runGraphQL<PrListQueryResult>(GRAPHQL_QUERY_PR_LIST, {
    owner,
    name: repo,
    first: limit,
    states: ["OPEN"],
  });

  if (!result.success) return [];

  const nodes = result.data?.data?.repository?.pullRequests?.nodes ?? [];

  return nodes
    .filter((n): n is PrListNode & { number: number } => !!n?.number)
    .map((n) => ({
      number: n.number,
      title: n.title ?? "",
      url: n.url ?? "",
      reviewDecision: n.reviewDecision ?? null,
      reviewThreadCount: n.reviewThreads?.totalCount ?? 0,
      reviewCount: n.reviews?.totalCount ?? 0,
    }));
}

// =============================================================================
// resolvePrFromHead - ブランチ名からPR番号を解決
// =============================================================================

/**
 * ブランチ名からオープンPRの番号を解決する。
 * 見つからない場合は null を返す。
 */
export async function resolvePrFromHead(
  headBranch: string,
  owner: string,
  repo: string,
  logger: Logger
): Promise<number | null> {
  try {
    const octokit = getOctokit();
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${headBranch}`,
      state: "open",
    });

    if (data.length === 0) {
      logger.error(`No open PR found for branch "${headBranch}"`);
      return null;
    }

    const prNumber = data[0].number;
    logger.debug(`Resolved branch "${headBranch}" → PR #${prNumber}`);
    return prNumber;
  } catch {
    logger.error(`No open PR found for branch "${headBranch}"`);
    return null;
  }
}

/** REST API から取得した PR の要約データ（review_decision は REST 非対応のため null 固定） */
export interface PrHeadDetails {
  number: number;
  title: string;
  state: string;
  head_branch: string;
  base_branch: string;
  author: string;
  review_decision: null;
  url: string;
}

/**
 * ブランチ名からオープンPRの詳細データを解決する。
 * REST API のレスポンスをそのまま利用するため GraphQL 呼び出しが不要。
 * review_decision は REST では取得できないため null を返す。
 * 見つからない場合は null を返す。
 */
export async function resolvePrFromHeadWithDetails(
  headBranch: string,
  owner: string,
  repo: string,
  logger: Logger
): Promise<PrHeadDetails | null> {
  try {
    const octokit = getOctokit();
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${headBranch}`,
      state: "open",
    });

    if (data.length === 0) {
      logger.error(`No open PR found for branch "${headBranch}"`);
      return null;
    }

    const pr = data[0];
    logger.debug(`Resolved branch "${headBranch}" → PR #${pr.number}`);
    return {
      number: pr.number,
      title: pr.title ?? "",
      state: pr.state?.toUpperCase() ?? "OPEN",
      head_branch: pr.head?.ref ?? headBranch,
      base_branch: pr.base?.ref ?? "",
      author: pr.user?.login ?? "",
      review_decision: null,
      url: pr.html_url ?? "",
    };
  } catch {
    logger.error(`No open PR found for branch "${headBranch}"`);
    return null;
  }
}
