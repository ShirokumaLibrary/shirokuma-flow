/**
 * items push - Discussion 本体の push ロジック (#1808)
 *
 * @related pull/discussion.ts - Discussion 取得・キャッシュ書き込み
 * @related add/discussion.ts - Discussion 作成ロジック
 */
import type { Logger } from "../../../utils/logger.js";
import type { CacheMetadata } from "../../../utils/github-cache.js";
import type { PushOptions } from "../../items/types.js";
/** Discussion GraphQL ID + title を番号から取得 */
export declare const GRAPHQL_QUERY_DISCUSSION_TITLE = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    discussion(number: $number) {\n      id\n      title\n      body\n      updatedAt\n    }\n  }\n}\n";
export interface DiscussionTitleQueryResult {
    data?: {
        repository?: {
            discussion?: {
                id?: string;
                title?: string;
                body?: string;
                updatedAt?: string;
            };
        };
    };
}
/** Discussion 本体を push */
export declare function pushDiscussionBody(owner: string, repo: string, number: number, localBody: string, localMeta: CacheMetadata, _options: PushOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=discussion.d.ts.map