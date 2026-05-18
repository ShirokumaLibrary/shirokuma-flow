/**
 * PR comments subcommand - Fetch PR review threads
 *
 * Fetches all review threads and comments for a given PR number.
 */

import { Logger } from "../../utils/logger.js";
import {
  runGraphQL,
  isIssueNumber,
  parseIssueNumber,
} from "../../utils/github.js";
import { formatOutput } from "../../utils/formatters.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import type { IssuesPrOptions } from "./types.js";

// =============================================================================
// GraphQL Query
// =============================================================================

export const GRAPHQL_QUERY_PR_REVIEW_THREADS = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      title
      state
      body
      reviewDecision
      reviews(first: 50) {
        totalCount
        nodes {
          author { login }
          state
          body
        }
      }
      reviewThreads(first: 50) {
        totalCount
        nodes {
          id
          isResolved
          isOutdated
          comments(first: 20) {
            nodes {
              id
              databaseId
              body
              path
              line
              author { login }
              createdAt
            }
          }
        }
      }
      comments(first: 50) {
        totalCount
        nodes {
          id
          databaseId
          body
          author { login }
          createdAt
        }
      }
    }
  }
}
`;

// =============================================================================
// Shared Types (GraphQL node types — #1752 変換ロジック共通化)
// =============================================================================

export interface ReviewNode {
  author?: { login?: string };
  state?: string;
  body?: string;
}

export interface CommentNode {
  id?: string;
  databaseId?: number;
  body?: string;
  path?: string | null;
  line?: number | null;
  author?: { login?: string };
  createdAt?: string;
}

export interface IssueCommentNode {
  id?: string;
  databaseId?: number;
  body?: string;
  author?: { login?: string };
  createdAt?: string;
}

export interface ThreadNode {
  id?: string;
  isResolved?: boolean;
  isOutdated?: boolean;
  comments?: { nodes?: CommentNode[] };
}

// =============================================================================
// Shared Transformation Functions (#1752 — 変換ロジック共通化)
// =============================================================================

export function transformReviews(nodes: ReviewNode[]) {
  return nodes.map((r) => ({
    author: r.author?.login ?? "unknown",
    state: r.state ?? "UNKNOWN",
    body: r.body ?? "",
  }));
}

export function transformThreads(nodes: ThreadNode[]) {
  return nodes.map((t) => {
    const comments = (t.comments?.nodes ?? []).map((c) => ({
      id: c.id ?? "",
      database_id: c.databaseId ?? 0,
      author: c.author?.login ?? "unknown",
      body: c.body ?? "",
      created_at: c.createdAt ?? "",
    }));

    const firstComment = t.comments?.nodes?.[0];
    return {
      id: t.id ?? "",
      is_resolved: t.isResolved ?? false,
      is_outdated: t.isOutdated ?? false,
      file: firstComment?.path ?? null,
      line: firstComment?.line ?? null,
      comments,
    };
  });
}

export function transformIssueComments(nodes: IssueCommentNode[]) {
  return nodes.map((c) => ({
    id: c.id ?? "",
    database_id: c.databaseId ?? 0,
    author: c.author?.login ?? "unknown",
    body: c.body ?? "",
    created_at: c.createdAt ?? "",
  }));
}

// =============================================================================
// cmdPrComments (#44)
// =============================================================================

export async function cmdPrComments(
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

  interface QueryResult {
    data?: {
      repository?: {
        pullRequest?: {
          title?: string;
          state?: string;
          body?: string;
          reviewDecision?: string | null;
          reviews?: { totalCount?: number; nodes?: ReviewNode[] };
          reviewThreads?: { totalCount?: number; nodes?: ThreadNode[] };
          comments?: { totalCount?: number; nodes?: IssueCommentNode[] };
        };
      };
    };
  }

  const result = await runGraphQL<QueryResult>(GRAPHQL_QUERY_PR_REVIEW_THREADS, {
    owner,
    name: repo,
    number: prNumber,
  });

  if (!result.success) {
    logger.error(`Failed to fetch PR #${prNumber}: ${result.error}`);
    return 1;
  }

  const pr = result.data?.data?.repository?.pullRequest;
  if (!pr) {
    logger.error(`PR #${prNumber} not found`);
    return 1;
  }

  const reviews = transformReviews(pr.reviews?.nodes ?? []);
  const threads = transformThreads(pr.reviewThreads?.nodes ?? []);
  const unresolvedCount = threads.filter((t) => !t.is_resolved).length;
  const issueComments = transformIssueComments(pr.comments?.nodes ?? []);

  const output = {
    pr_number: prNumber,
    title: pr.title ?? "",
    state: pr.state ?? "UNKNOWN",
    review_decision: pr.reviewDecision ?? null,
    reviews,
    threads,
    total_threads: threads.length,
    unresolved_threads: unresolvedCount,
    issue_comments: issueComments,
    total_issue_comments: issueComments.length,
  };

  const outputFormat = options.format ?? "json";
  const formatted = formatOutput(output, outputFormat, {
    arrayKey: "threads",
  });
  console.log(formatted);
  return 0;
}
