/**
 * github-item lint fetcher（非純粋層）
 *
 * github-item-comment-first / github-item-body-history ルールの check* が使う取得層。
 * 副作用のない `runGraphQL` 直呼びで `GitHubItemLintInput` を組み立てる。
 *
 * 種別判定（issue / PR / discussion）:
 *   設計本文に明示の判定経路がないため、Issue/PR を `issueOrPullRequest` で一括取得し
 *   `__typename` で issue / pull を区別する。番号が Issue/PR として存在しない（node が null）
 *   場合は Discussion クエリにフォールバックする。
 *   フォールバック条件: issueOrPullRequest が null（= その番号は Issue/PR ではない）、
 *   または GraphQL が NOT_FOUND を返した場合。
 */

import { runGraphQL } from "../utils/github.js";
import { resolveTargetRepo } from "../utils/repo-pairs.js";
import type { GitHubItemLintInput, GitHubItemLintComment } from "./github-item-types.js";

// =============================================================================
// GraphQL Queries
// =============================================================================

/**
 * Issue / PR の本文・日時・コメント全件を一括取得する lint 用クエリ（新規定義）。
 *
 * `issueOrPullRequest` は Issue / PullRequest の両方を返す union。`__typename` で種別を判定する。
 * `comments(first: 100)` は CREATED_AT 昇順で返るため nodes[0] が最古コメント。
 */
export const GRAPHQL_QUERY_LINT_ISSUE = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issueOrPullRequest(number: $number) {
      __typename
      ... on Issue {
        number
        body
        createdAt
        updatedAt
        comments(first: 100) {
          totalCount
          nodes { body createdAt }
        }
      }
      ... on PullRequest {
        number
        body
        createdAt
        updatedAt
        comments(first: 100) {
          totalCount
          nodes { body createdAt }
        }
      }
    }
  }
}
`;

/**
 * Discussion 本体＋コメント全件を取得する lint 用クエリ。
 * `discussions/helpers.ts` の GRAPHQL_QUERY_DISCUSSION と
 * `pull/discussion.ts` の GRAPHQL_QUERY_DISCUSSION_COMMENTS の必要フィールドを 1 クエリに統合する
 * （lint では本体と最古コメントを同時に必要とするため複製）。
 */
export const GRAPHQL_QUERY_LINT_DISCUSSION = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
      number
      body
      createdAt
      updatedAt
      category { name }
      comments(first: 100) {
        totalCount
        nodes { body createdAt }
      }
    }
  }
}
`;

// =============================================================================
// Internal types
// =============================================================================

interface RawCommentNode {
  body?: string;
  createdAt?: string;
}

interface RawCommentConnection {
  totalCount?: number;
  nodes?: RawCommentNode[];
}

interface IssueOrPullResult {
  data?: {
    repository?: {
      issueOrPullRequest?: {
        __typename?: string;
        number?: number;
        body?: string;
        createdAt?: string;
        updatedAt?: string;
        comments?: RawCommentConnection;
      } | null;
    };
  };
}

interface DiscussionResult {
  data?: {
    repository?: {
      discussion?: {
        number?: number;
        body?: string;
        createdAt?: string;
        updatedAt?: string;
        category?: { name?: string };
        comments?: RawCommentConnection;
      } | null;
    };
  };
}

// =============================================================================
// Helpers
// =============================================================================

function mapComments(conn: RawCommentConnection | undefined): GitHubItemLintComment[] {
  return (conn?.nodes ?? [])
    .filter((n): n is { body: string; createdAt: string } =>
      typeof n.body === "string" && typeof n.createdAt === "string"
    )
    .map((n) => ({ body: n.body, createdAt: n.createdAt }));
}

// =============================================================================
// Fetcher
// =============================================================================

/**
 * 番号から GitHubItemLintInput を組み立てる。
 *
 * Issue/PR を先に試行し、存在しなければ Discussion にフォールバックする。
 * いずれにも該当しない（取得失敗を含む）場合は null を返す。
 */
export async function fetchGitHubItemLintInput(
  itemNumber: number,
  options: { public?: boolean; repo?: string } = {}
): Promise<GitHubItemLintInput | null> {
  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) return null;
  const { owner, name } = repoInfo;

  // 1. Issue / PR を試行
  const ipResult = await runGraphQL<IssueOrPullResult>(
    GRAPHQL_QUERY_LINT_ISSUE,
    { owner, name, number: itemNumber },
    { silent: true }
  );

  if (ipResult.success) {
    const node = ipResult.data?.data?.repository?.issueOrPullRequest;
    // node が存在する = Issue/PR として実在
    if (node && node.body !== undefined && node.createdAt && node.updatedAt) {
      const type = node.__typename === "PullRequest" ? "pull" : "issue";
      return {
        number: node.number ?? itemNumber,
        type,
        body: node.body ?? "",
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        comments: mapComments(node.comments),
        totalCommentCount: node.comments?.totalCount ?? 0,
      };
    }
    // node が null = Issue/PR ではない → Discussion フォールバックへ
  }

  // 2. Discussion にフォールバック（Issue/PR が null または NOT_FOUND だった場合）
  const dResult = await runGraphQL<DiscussionResult>(
    GRAPHQL_QUERY_LINT_DISCUSSION,
    { owner, name, number: itemNumber },
    { silent: true }
  );

  if (dResult.success) {
    const node = dResult.data?.data?.repository?.discussion;
    if (node && node.body !== undefined && node.createdAt && node.updatedAt) {
      return {
        number: node.number ?? itemNumber,
        type: "discussion",
        category: node.category?.name,
        body: node.body ?? "",
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        comments: mapComments(node.comments),
        totalCommentCount: node.comments?.totalCount ?? 0,
      };
    }
  }

  // いずれにも該当しない
  return null;
}
