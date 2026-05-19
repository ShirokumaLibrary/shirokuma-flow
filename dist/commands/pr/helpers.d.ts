/**
 * PR command helpers
 *
 * Pure/helper functions for the pr command and its subcommands.
 */
import { Logger } from "../../utils/logger.js";
import type { PrSummary, LinkPattern, LinkGraphEntry } from "./types.js";
/**
 * Validate that at most one merge method is specified.
 * Returns error message or null if valid.
 */
export declare function validateMergeMethod(options: {
    squash?: boolean;
    merge?: boolean;
    rebase?: boolean;
}): string | null;
/**
 * Determine the merge method from options. Defaults to "squash".
 */
export declare function parseMergeMethod(options: {
    squash?: boolean;
    merge?: boolean;
    rebase?: boolean;
}): "squash" | "merge" | "rebase";
/**
 * Parse linked issue numbers from PR body text.
 * Looks for patterns: Closes #N, Fixes #N, Resolves #N (case-insensitive).
 * Returns deduplicated array of issue numbers.
 */
export declare function parseLinkedIssues(body: string | undefined | null): number[];
/**
 * Detect the PR-Issue link pattern from a mapping of issues to their linked PRs.
 * Pure function (no API calls) — exported for testing.
 *
 * @param linkedIssues - Issue numbers linked by the current PR
 * @param issueToAllPrs - Map of issue number → all PR numbers that reference it with closing keywords
 */
export declare function detectLinkPattern(linkedIssues: number[], issueToAllPrs: Map<number, number[]>): LinkPattern;
/**
 * Build a link graph for the given PR by searching for other open PRs
 * that also reference the same issues with closing keywords.
 *
 * Uses GitHub Search API to find open PRs mentioning each issue,
 * then verifies with parseLinkedIssues for precision.
 */
export declare function buildLinkGraph(owner: string, repo: string, currentPr: number, linkedIssues: number[], logger: Logger): Promise<{
    pattern: LinkPattern;
    entries: LinkGraphEntry[];
}>;
export declare const GRAPHQL_QUERY_PR_LIST = "\nquery($owner: String!, $name: String!, $first: Int!, $states: [PullRequestState!]) {\n  repository(owner: $owner, name: $name) {\n    pullRequests(first: $first, states: $states, orderBy: {field: CREATED_AT, direction: DESC}) {\n      nodes {\n        number\n        title\n        state\n        url\n        headRefName\n        baseRefName\n        author { login }\n        reviewDecision\n        reviewThreads(first: 0) { totalCount }\n        reviews(first: 0) { totalCount }\n      }\n    }\n  }\n}\n";
/**
 * --state オプション値を GraphQL PullRequestState enum 配列に変換する。
 * 無効な値の場合は null を返す。
 */
export declare function parsePrStateFilter(state: string): ("OPEN" | "CLOSED" | "MERGED")[] | null;
export declare function fetchOpenPRs(owner: string, repo: string, limit?: number): Promise<PrSummary[]>;
/**
 * ブランチ名からオープンPRの番号を解決する。
 * 見つからない場合は null を返す。
 */
export declare function resolvePrFromHead(headBranch: string, owner: string, repo: string, logger: Logger): Promise<number | null>;
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
export declare function resolvePrFromHeadWithDetails(headBranch: string, owner: string, repo: string, logger: Logger): Promise<PrHeadDetails | null>;
//# sourceMappingURL=helpers.d.ts.map