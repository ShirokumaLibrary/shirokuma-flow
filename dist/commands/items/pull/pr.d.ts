/**
 * items pull - PR 取得・キャッシュ書き込み (#1808)
 */
import type { Logger } from "../../../utils/logger.js";
import type { RemoteItemSnapshot } from "../types.js";
/** PR 詳細取得（本文 + メタデータ） */
export declare const GRAPHQL_QUERY_PR_WITH_FIELDS = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    pullRequest(number: $number) {\n      number\n      title\n      body\n      url\n      state\n      updatedAt\n      headRefName\n      baseRefName\n      author { login }\n      labels(first: 20) {\n        nodes { name }\n      }\n    }\n  }\n}\n";
/** PR コメント・レビュースレッド取得（first: 100） */
export declare const GRAPHQL_QUERY_PR_COMMENTS = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    pullRequest(number: $number) {\n      comments(first: 100) {\n        totalCount\n        nodes {\n          id\n          databaseId\n          author { login }\n          body\n          createdAt\n          updatedAt\n          url\n        }\n      }\n    }\n  }\n}\n";
/**
 * PR 本体 + コメントを取得してキャッシュに書き込む。
 * `RemoteItemSnapshot` を返す。
 */
export declare function fetchAndCachePr(owner: string, repo: string, number: number, org: string, baseDir?: string, logger?: Logger): Promise<RemoteItemSnapshot | null>;
//# sourceMappingURL=pr.d.ts.map