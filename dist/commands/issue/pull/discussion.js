/**
 * items pull - Discussion 取得・キャッシュ書き込み (#1808)
 *
 * @related push/discussion.ts - Discussion 本体の push ロジック
 * @related add/discussion.ts - Discussion 作成ロジック
 */
import { runGraphQL } from "../../../utils/github.js";
import { writeCache, writeCommentCache } from "../../../utils/github-cache.js";
// =============================================================================
// GraphQL クエリ定義
// =============================================================================
/** Discussion 詳細取得（Projects フィールドは Discussion には存在しないため省略） */
export const GRAPHQL_QUERY_DISCUSSION_WITH_FIELDS = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
      number
      title
      body
      url
      updatedAt
      author { login }
      category { name }
    }
  }
}
`;
/** Discussion コメント取得（first: 100） */
export const GRAPHQL_QUERY_DISCUSSION_COMMENTS = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
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
          isAnswer
          replies(first: 20) {
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
  }
}
`;
// =============================================================================
// Discussion 取得・キャッシュ書き込み
// =============================================================================
/**
 * Discussion 本体 + コメントを取得してキャッシュに書き込む。
 * `RemoteItemSnapshot` を返す（check コマンドとの共有用）。
 */
export async function fetchAndCacheDiscussion(owner, repo, number, org, baseDir, logger) {
    const graphqlVars = { owner, name: repo, number };
    // 本体とコメントを並列取得
    const [discussionResult, commentsResult] = await Promise.all([
        runGraphQL(GRAPHQL_QUERY_DISCUSSION_WITH_FIELDS, graphqlVars),
        runGraphQL(GRAPHQL_QUERY_DISCUSSION_COMMENTS, graphqlVars),
    ]);
    if (!discussionResult.success || !discussionResult.data?.data?.repository?.discussion) {
        return null;
    }
    const node = discussionResult.data.data.repository.discussion;
    // キャッシュ書き込み（Discussion には Projects フィールドなし）
    const cacheMetadata = {
        number,
        type: "discussion",
        updated_at: node.updatedAt,
        title: node.title,
    };
    writeCache(number, cacheMetadata, node.body ?? "", org, repo, baseDir);
    // コメント（トップレベル）と返信をキャッシュ書き込み
    if (commentsResult.success && commentsResult.data?.data?.repository?.discussion?.comments) {
        const commentsData = commentsResult.data.data.repository.discussion.comments;
        const nodes = commentsData.nodes ?? [];
        const totalCount = commentsData.totalCount ?? 0;
        if (nodes.length < totalCount) {
            logger?.warn(`Discussion #${number}: comments ${nodes.length}/${totalCount} 件取得（上限超過）`);
        }
        for (const c of nodes) {
            if (c.databaseId) {
                writeCommentCache(number, c.databaseId, {
                    number,
                    database_id: c.databaseId,
                    updated_at: c.updatedAt,
                }, c.body ?? "", "discussion", org, repo, baseDir);
                // 返信もキャッシュ書き込み
                const replies = c.replies?.nodes ?? [];
                const repliesTotal = c.replies?.totalCount ?? 0;
                if (replies.length < repliesTotal) {
                    logger?.warn(`Discussion #${number} comment: replies ${replies.length}/${repliesTotal} 件取得（上限超過）`);
                }
                for (const r of replies) {
                    if (r.databaseId) {
                        writeCommentCache(number, r.databaseId, {
                            number,
                            database_id: r.databaseId,
                            reply_to: c.databaseId,
                        }, r.body ?? "", "discussion", org, repo, baseDir);
                    }
                }
            }
        }
        logger?.info(`Discussion #${number}: ${nodes.length} コメントをキャッシュしました`);
    }
    return {
        number,
        type: "discussion",
        title: node.title ?? "",
        body: node.body ?? "",
        updated_at: node.updatedAt ?? "",
    };
}
//# sourceMappingURL=discussion.js.map