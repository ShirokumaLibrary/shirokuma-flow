/**
 * items push サブコマンド (#1808)
 *
 * ローカルキャッシュファイルと GitHub のリモート状態を比較し、差分を検出してアップロードする。
 *
 * 対応する更新対象:
 * - Issue 本文（GraphQL updateIssue mutation）
 * - Issue title（GraphQL updateIssue mutation）
 * - Issue ラベル（frontmatter labels フィールドの差分を add/remove）
 * - Issue 担当者（frontmatter assignees フィールドの差分を add/remove）
 * - Discussion 本文（GraphQL updateDiscussion mutation）
 * - Discussion title（GraphQL updateDiscussion mutation）
 * - Projects フィールド（Status/Priority/Size）
 * - コメント本文（REST API PATCH / GraphQL updateDiscussionComment）
 *
 * ステータス遷移バリデーション:
 * - 通常あり得ない遷移は警告で停止する
 * - `--force` で強制実行
 */
import type { Logger } from "../../../utils/logger.js";
import type { PushOptions } from "../types.js";
/**
 * items push サブコマンド
 *
 * 引数:
 * - `numberStr`: アイテム番号
 * - `commentId`: コメント databaseId（省略時は本体を push）
 */
export declare function cmdPush(numberStr: string, commentIdStr: string | undefined, options: PushOptions, logger: Logger): Promise<number>;
export { pushIssueBody } from "./issue.js";
export { pushDiscussionBody } from "./discussion.js";
export { pushComment, pushIssueComment, pushDiscussionComment } from "./comment.js";
//# sourceMappingURL=index.d.ts.map