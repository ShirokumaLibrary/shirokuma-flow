/**
 * items pull - PR 取得・キャッシュ書き込み (#1808)
 */

import { runGraphQL } from "../../../utils/github.js";
import { writeCache, writeCommentCache } from "../../../utils/github-cache.js";
import type { Logger } from "../../../utils/logger.js";
import type { RemoteItemSnapshot } from "../../items/types.js";

// =============================================================================
// GraphQL クエリ定義
// =============================================================================

/** PR 詳細取得（本文 + メタデータ） */
export const GRAPHQL_QUERY_PR_WITH_FIELDS = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number
      title
      body
      url
      state
      updatedAt
      headRefName
      baseRefName
      author { login }
      labels(first: 20) {
        nodes { name }
      }
    }
  }
}
`;

/** PR コメント・レビュースレッド取得（first: 100） */
export const GRAPHQL_QUERY_PR_COMMENTS = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      comments(first: 100) {
        totalCount
        nodes {
          id
          databaseId
          author { login }
          body
          createdAt
          updatedAt
          url
        }
      }
    }
  }
}
`;

// =============================================================================
// 内部型定義
// =============================================================================

interface PrNode {
  number?: number;
  title?: string;
  body?: string;
  url?: string;
  state?: string;
  updatedAt?: string;
  headRefName?: string;
  baseRefName?: string;
  author?: { login?: string };
  labels?: { nodes?: Array<{ name?: string }> };
}

interface PrQueryResult {
  data?: {
    repository?: {
      pullRequest?: PrNode;
    };
  };
}

interface PrCommentNode {
  id?: string;
  databaseId?: number;
  author?: { login?: string };
  body?: string;
  createdAt?: string;
  updatedAt?: string;
  url?: string;
}

interface PrCommentsQueryResult {
  data?: {
    repository?: {
      pullRequest?: {
        comments?: {
          totalCount?: number;
          nodes?: PrCommentNode[];
        };
      };
    };
  };
}

// =============================================================================
// PR 取得・キャッシュ書き込み
// =============================================================================

/**
 * PR 本体 + コメントを取得してキャッシュに書き込む。
 * `RemoteItemSnapshot` を返す。
 */
export async function fetchAndCachePr(
  owner: string,
  repo: string,
  number: number,
  org: string,
  baseDir?: string,
  logger?: Logger
): Promise<RemoteItemSnapshot | null> {
  const graphqlVars = { owner, name: repo, number };

  // 本体を先に取得（PR かどうかを確認してからコメントを取得する）
  const prResult = await runGraphQL<PrQueryResult>(GRAPHQL_QUERY_PR_WITH_FIELDS, graphqlVars);

  if (!prResult.success || !prResult.data?.data?.repository?.pullRequest) {
    return null;
  }

  const node = prResult.data.data.repository.pullRequest;
  const labels = (node.labels?.nodes ?? []).map((l) => l?.name ?? "").filter(Boolean);

  // キャッシュ書き込み
  const cacheMetadata = {
    number,
    type: "pull_request" as const,
    updated_at: node.updatedAt,
    title: node.title,
    labels: labels.length > 0 ? labels : undefined,
  };

  writeCache(number, cacheMetadata, node.body ?? "", org, repo, baseDir);

  // PR 確認後にコメントを取得（自動判別時の無駄なクエリを防止）
  const commentsResult = await runGraphQL<PrCommentsQueryResult>(GRAPHQL_QUERY_PR_COMMENTS, graphqlVars);

  // コメントをキャッシュ書き込み
  if (commentsResult.success && commentsResult.data?.data?.repository?.pullRequest?.comments) {
    const commentsData = commentsResult.data.data.repository.pullRequest.comments;
    const nodes = commentsData.nodes ?? [];

    const totalCount = commentsData.totalCount ?? 0;
    if (nodes.length < totalCount) {
      logger?.warn(`PR #${number}: comments ${nodes.length}/${totalCount} 件取得（上限超過）`);
    }

    for (const c of nodes) {
      if (c.databaseId) {
        writeCommentCache(
          number,
          c.databaseId,
          {
            number,
            database_id: c.databaseId,
            updated_at: c.updatedAt,
          },
          c.body ?? "",
          "pull_request",
          org,
          repo,
          baseDir
        );
      }
    }

    logger?.info(`PR #${number}: ${nodes.length} コメントをキャッシュしました`);
  }

  return {
    number,
    type: "pull_request",
    title: node.title ?? "",
    body: node.body ?? "",
    updated_at: node.updatedAt ?? "",
    labels: labels.length > 0 ? labels : undefined,
  };
}
