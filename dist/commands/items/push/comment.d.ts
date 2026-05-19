/**
 * items push - コメント push ロジック (#1808)
 *
 * @related add/comment.ts - コメント追加ロジック
 */
import type { Logger } from "../../../utils/logger.js";
import type { CommentCacheMetadata } from "../../../utils/github-cache.js";
import type { PushOptions } from "../types.js";
/**
 * コメント push のエントリポイント。
 * 親アイテムの種別（Issue / Discussion）を判定してディスパッチする。
 */
export declare function pushComment(owner: string, repo: string, number: number, commentIdStr: string, options: PushOptions, logger: Logger): Promise<number>;
/** Issue / PR コメントを push (REST API) */
export declare function pushIssueComment(owner: string, repo: string, number: number, databaseId: number, localBody: string, localMeta: CommentCacheMetadata, _options: PushOptions, logger: Logger, baseDir?: string, type?: "issue" | "pull_request"): Promise<number>;
/** Discussion コメントを push (GraphQL) */
export declare function pushDiscussionComment(owner: string, repo: string, number: number, databaseId: number, localBody: string, localMeta: CommentCacheMetadata, _options: PushOptions, logger: Logger, baseDir?: string): Promise<number>;
//# sourceMappingURL=comment.d.ts.map