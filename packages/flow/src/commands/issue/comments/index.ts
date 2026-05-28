/**
 * items comments サブコマンド (#1814, #2024)
 *
 * issues comments から移行。Issue の全コメントを GraphQL で取得する。
 *
 * ADR-v3-025 (#2776): キャッシュ優先読み取り経路は廃止。常に API 直取得し、
 * `processIssueContext` 内の write-through 経路でキャッシュは引き続き更新される。
 */

import {
  runGraphQL,
  isIssueNumber,
  parseIssueNumber,
} from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
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

  // ADR-v3-025: 読み取りは常に API 直取得。キャッシュ優先ショートカットは廃止。

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
