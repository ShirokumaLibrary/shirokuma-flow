/**
 * items add comment - コメント追加ロジック (#1808)
 *
 * @related push/comment.ts - コメント push ロジック
 */
import type { Logger } from "../../../utils/logger.js";
import type { AddCommentOptions } from "../types.js";
/**
 * Issue / PR / Discussion にコメントを追加する。
 * アイテム種別は自動判別（Issue → PR → Discussion の順で試みる）。
 */
export declare function cmdAddComment(numberStr: string, options: AddCommentOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=comment.d.ts.map