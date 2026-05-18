/**
 * items push - コメント push ロジック (#1808)
 *
 * @related add/comment.ts - コメント追加ロジック
 */

import { runGraphQL, validateBody } from "../../../utils/github.js";
import { getOctokit } from "../../../utils/octokit-client.js";
import { probeReadCache, readCommentCache, writeCommentCache, GITHUB_CACHE_DIR } from "../../../utils/github-cache.js";
import { getDiscussionId } from "../../discussions/helpers.js";
import type { Logger } from "../../../utils/logger.js";
import type { CommentCacheMetadata } from "../../../utils/github-cache.js";
import type { PushOptions } from "../../items/types.js";

// =============================================================================
// コメント push ディスパッチャ
// =============================================================================

/**
 * コメント push のエントリポイント。
 * 親アイテムの種別（Issue / Discussion）を判定してディスパッチする。
 */
export async function pushComment(
  owner: string,
  repo: string,
  number: number,
  commentIdStr: string,
  options: PushOptions,
  logger: Logger
): Promise<number> {
  const databaseId = parseInt(commentIdStr, 10);
  if (isNaN(databaseId) || databaseId <= 0) {
    logger.error(`無効なコメント ID: ${commentIdStr}`);
    return 1;
  }

  // 親アイテムの type をプローブして特定する
  const baseDir = GITHUB_CACHE_DIR;
  const parentCached = probeReadCache(number, owner, repo, baseDir);
  const parentType = parentCached?.metadata.type;

  // ローカルコメントキャッシュを読み込む
  const commentType = parentType ?? "issue";
  const cached = readCommentCache(number, databaseId, commentType, owner, repo, baseDir);
  if (!cached) {
    // Discussion コメントの場合は discussion type で再試行
    const cached2 = parentType === undefined
      ? readCommentCache(number, databaseId, "discussion", owner, repo, baseDir)
      : null;
    if (!cached2) {
      logger.error(`コメント ${databaseId} のキャッシュが見つかりません。先に items pull ${number} を実行してください`);
      return 1;
    }
    const { metadata, body } = cached2;
    return pushDiscussionComment(owner, repo, number, databaseId, body, metadata, options, logger, baseDir);
  }

  const { metadata, body } = cached;
  const isDiscussionComment = metadata.reply_to !== undefined;

  if (parentType === "discussion" || isDiscussionComment) {
    return pushDiscussionComment(owner, repo, number, databaseId, body, metadata, options, logger, baseDir);
  } else {
    // デフォルトは Issue コメント（REST API）
    const issueOrPrType: "issue" | "pull_request" = commentType === "pull_request" ? "pull_request" : "issue";
    return pushIssueComment(owner, repo, number, databaseId, body, metadata, options, logger, baseDir, issueOrPrType);
  }
}

// =============================================================================
// Issue / PR コメント push
// =============================================================================

/** Issue / PR コメントを push (REST API) */
export async function pushIssueComment(
  owner: string,
  repo: string,
  number: number,
  databaseId: number,
  localBody: string,
  localMeta: CommentCacheMetadata,
  _options: PushOptions,
  logger: Logger,
  baseDir: string = GITHUB_CACHE_DIR,
  type: "issue" | "pull_request" = "issue"
): Promise<number> {
  // コメント本文の不正 Unicode 検証
  const bodyError = validateBody(localBody);
  if (bodyError) {
    logger.error(bodyError);
    return 1;
  }

  // REST API でコメントを更新
  try {
    const octokit = getOctokit();
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: databaseId,
      body: localBody,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`コメント ${databaseId} の更新に失敗しました: ${errorMsg}`);
    return 1;
  }

  logger.success(`Issue #${number} コメント ${databaseId}: 更新しました`);

  // キャッシュの cached_at を更新
  writeCommentCache(number, databaseId, {
    ...localMeta,
    number,
    database_id: databaseId,
  }, localBody, type, owner, repo, baseDir);

  console.log(JSON.stringify({
    number,
    comment_database_id: databaseId,
    type: "issue_comment",
    updated: true,
  }, null, 2));
  return 0;
}

// =============================================================================
// Discussion コメント push
// =============================================================================

/** Discussion コメントを push (GraphQL) */
export async function pushDiscussionComment(
  owner: string,
  repo: string,
  number: number,
  databaseId: number,
  localBody: string,
  localMeta: CommentCacheMetadata,
  _options: PushOptions,
  logger: Logger,
  baseDir: string = GITHUB_CACHE_DIR
): Promise<number> {
  // コメント本文の不正 Unicode 検証
  const bodyError = validateBody(localBody);
  if (bodyError) {
    logger.error(bodyError);
    return 1;
  }

  // コメントの GraphQL ID を取得するためにまず Discussion ID を取得
  const discussionId = await getDiscussionId(owner, repo, number);
  if (!discussionId) {
    logger.error(`Discussion #${number} が見つかりません`);
    return 1;
  }

  // Discussion コメントの GraphQL ID を databaseId から解決する
  // GraphQL nodeId は `DC_kwDO...` 形式だが databaseId から直接取得できないため、
  // コメント一覧から検索する
  const QUERY_DISCUSSION_COMMENT_ID = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
      comments(first: 100) {
        nodes {
          id
          databaseId
          replies(first: 20) {
            nodes {
              id
              databaseId
            }
          }
        }
      }
    }
  }
}
`;

  interface CommentIdQueryResult {
    data?: {
      repository?: {
        discussion?: {
          comments?: {
            nodes?: Array<{
              id?: string;
              databaseId?: number;
              replies?: {
                nodes?: Array<{
                  id?: string;
                  databaseId?: number;
                }>;
              };
            }>;
          };
        };
      };
    };
  }

  const commentIdResult = await runGraphQL<CommentIdQueryResult>(QUERY_DISCUSSION_COMMENT_ID, {
    owner,
    name: repo,
    number,
  });

  if (!commentIdResult.success) {
    logger.error(`Discussion #${number} のコメント一覧取得に失敗しました`);
    return 1;
  }

  const comments = commentIdResult.data?.data?.repository?.discussion?.comments?.nodes ?? [];
  let commentGqlId: string | null = null;

  // トップレベルコメントを検索
  for (const c of comments) {
    if (c.databaseId === databaseId) {
      commentGqlId = c.id ?? null;
      break;
    }
    // 返信を検索
    for (const r of c.replies?.nodes ?? []) {
      if (r.databaseId === databaseId) {
        commentGqlId = r.id ?? null;
        break;
      }
    }
    if (commentGqlId) break;
  }

  if (!commentGqlId) {
    logger.error(`コメント ${databaseId} の GraphQL ID が見つかりません`);
    return 1;
  }

  const GRAPHQL_MUTATION_UPDATE_DISCUSSION_COMMENT = `
mutation($id: ID!, $body: String!) {
  updateDiscussionComment(input: {commentId: $id, body: $body}) {
    comment {
      id
      databaseId
      body
    }
  }
}
`;

  // GraphQL で Discussion コメントを更新
  const updateResult = await runGraphQL(GRAPHQL_MUTATION_UPDATE_DISCUSSION_COMMENT, {
    id: commentGqlId,
    body: localBody,
  });

  if (!updateResult.success) {
    logger.error(`コメント ${databaseId} の更新に失敗しました`);
    return 1;
  }

  logger.success(`Discussion #${number} コメント ${databaseId}: 更新しました`);

  // キャッシュの cached_at を更新
  writeCommentCache(number, databaseId, {
    ...localMeta,
    number,
    database_id: databaseId,
  }, localBody, "discussion", owner, repo, baseDir);

  console.log(JSON.stringify({
    number,
    comment_database_id: databaseId,
    type: "discussion_comment",
    updated: true,
  }, null, 2));
  return 0;
}
