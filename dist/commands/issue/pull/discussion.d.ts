/**
 * items pull - Discussion 取得・キャッシュ書き込み (#1808)
 *
 * @related push/discussion.ts - Discussion 本体の push ロジック
 * @related add/discussion.ts - Discussion 作成ロジック
 */
import type { Logger } from "../../../utils/logger.js";
import type { RemoteItemSnapshot } from "../../items/types.js";
/** Discussion 詳細取得（Projects フィールドは Discussion には存在しないため省略） */
export declare const GRAPHQL_QUERY_DISCUSSION_WITH_FIELDS = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    discussion(number: $number) {\n      number\n      title\n      body\n      url\n      updatedAt\n      author { login }\n      category { name }\n    }\n  }\n}\n";
/** Discussion コメント取得（first: 100） */
export declare const GRAPHQL_QUERY_DISCUSSION_COMMENTS = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    discussion(number: $number) {\n      comments(first: 100) {\n        totalCount\n        nodes {\n          id\n          databaseId\n          author { login }\n          body\n          createdAt\n          updatedAt\n          url\n          isAnswer\n          replies(first: 20) {\n            totalCount\n            nodes {\n              id\n              databaseId\n              author { login }\n              body\n              createdAt\n              url\n            }\n          }\n        }\n      }\n    }\n  }\n}\n";
export interface DiscussionNode {
    number?: number;
    title?: string;
    body?: string;
    url?: string;
    updatedAt?: string;
    author?: {
        login?: string;
    };
    category?: {
        name?: string;
    };
}
export interface DiscussionQueryResult {
    data?: {
        repository?: {
            discussion?: DiscussionNode;
        };
    };
}
/**
 * Discussion 本体 + コメントを取得してキャッシュに書き込む。
 * `RemoteItemSnapshot` を返す（check コマンドとの共有用）。
 */
export declare function fetchAndCacheDiscussion(owner: string, repo: string, number: number, org: string, baseDir?: string, logger?: Logger): Promise<RemoteItemSnapshot | null>;
//# sourceMappingURL=discussion.d.ts.map