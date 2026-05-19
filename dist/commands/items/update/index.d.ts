/**
 * items update サブコマンド (#2024 Phase 1-A)
 *
 * Issue / Discussion の本文・メタデータを1コマンドで更新する。
 * `items pull → 編集 → items push` の3ステップを置き換える。
 *
 * 対応フィールド:
 * - body (--body <file>): 本文をファイル内容で更新
 * - title (--title <title>): タイトルを更新
 * - status (--status <status>): ステータスを更新（transition バリデーション通過後）
 * - priority (--priority <priority>): Priority を更新
 * - size (--size <size>): Size を更新
 * - labels (--labels <labels>): ラベルを上書き設定
 * - add-label (--add-label <label>): ラベルを追加
 * - remove-label (--remove-label <label>): ラベルを削除
 * - assign (--assign <user>): 担当者を追加
 * - unassign (--unassign <user>): 担当者を削除
 * - comment (--comment <id> --body <file>): 既存コメントを更新
 */
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../types.js";
/** items update サブコマンドのオプション */
export interface UpdateOptions extends ItemsOptions {
    /** 本文をファイル内容で更新 */
    body?: string;
    /** タイトルを更新 */
    title?: string;
    /** ステータスを更新（transition バリデーション通過後） */
    status?: string;
    /** Priority を更新 */
    priority?: string;
    /** Size を更新 */
    size?: string;
    /** ラベルを上書き設定（カンマ区切り） */
    labels?: string;
    /** ラベルを追加 */
    addLabel?: string;
    /** ラベルを削除 */
    removeLabel?: string;
    /** 担当者を追加 */
    assign?: string;
    /** 担当者を削除 */
    unassign?: string;
    /** コメント ID（既存コメント更新時） */
    comment?: string;
}
/**
 * items update サブコマンド
 *
 * Issue / Discussion のフィールドを複合更新する。
 */
export declare function cmdItemUpdate(numberStr: string, options: UpdateOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map