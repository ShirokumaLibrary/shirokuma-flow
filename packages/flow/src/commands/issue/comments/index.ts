/**
 * items comments サブコマンド (#1814, #2024)
 *
 * issues comments から移行。Issue の全コメントを GraphQL で取得する。
 * #2024 Phase 2-D: context cache を優先参照し、miss 時は API フォールバック。
 */

import {
  runGraphQL,
  isIssueNumber,
  parseIssueNumber,
} from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { readContextCache } from "../../../utils/context-cache.js";
import type { Logger } from "../../../utils/logger.js";
import type { CommentsOptions } from "../../items/types.js";

// =============================================================================
// GraphQL Queries
// =============================================================================

export const GRAPHQL_QUERY_ISSUE_COMMENTS = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      number
      comments(first: 100) {
        totalCount
        nodes {
          id
          databaseId
          author { login }
          body
          createdAt
          url
        }
      }
    }
  }
}
`;

// =============================================================================
// Command
// =============================================================================

/**
 * items comments サブコマンド
 *
 * Issue の全コメントを一覧表示する。
 */
export async function cmdComments(
  issueNumberStr: string,
  options: CommentsOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(issueNumberStr)) {
    logger.error("Valid issue number required");
    return 1;
  }

  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;
  const number = parseIssueNumber(issueNumberStr);

  // コンテキストキャッシュを確認（#2024 Phase 2-D）
  interface CachedComment {
    id?: string;
    database_id?: number;
    source?: string;
    author?: string;
    body?: string;
    created_at?: string;
    url?: string;
  }
  const cachedComments = readContextCache<CachedComment[]>("comments", `issue-${number}`);
  if (cachedComments && Array.isArray(cachedComments)) {
    logger.info(`Issue #${number} のコメントをキャッシュから取得します`);
    const comments = cachedComments.map((c, i) => ({
      id: c.id ?? String(i),
      database_id: c.database_id ?? null,
      author: c.author ?? null,
      body: c.body ?? null,
      created_at: c.created_at ?? null,
      url: c.url ?? null,
    }));
    console.log(JSON.stringify(comments, null, 2));
    return 0;
  }

  interface CommentNode {
    id?: string;
    databaseId?: number;
    author?: { login?: string };
    body?: string;
    createdAt?: string;
    url?: string;
  }

  interface QueryResult {
    data?: {
      repository?: {
        issue?: {
          number?: number;
          comments?: {
            totalCount?: number;
            nodes?: CommentNode[];
          };
        };
      };
    };
  }

  const result = await runGraphQL<QueryResult>(GRAPHQL_QUERY_ISSUE_COMMENTS, {
    owner,
    name: repo,
    number,
  });

  if (!result.success || !result.data?.data?.repository?.issue) {
    logger.error(`Issue #${number} not found`);
    return 1;
  }

  const issue = result.data.data.repository.issue;
  const commentsData = issue.comments;
  const nodes = commentsData?.nodes ?? [];

  const comments = nodes.map((c) => ({
    id: c.id,
    database_id: c.databaseId,
    author: c.author?.login ?? null,
    body: c.body,
    created_at: c.createdAt,
    url: c.url,
  }));

  console.log(JSON.stringify(comments, null, 2));
  return 0;
}
