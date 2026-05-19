/**
 * Frontmatter Input Utility
 *
 * --from-file オプション用のコアロジック。
 * フロントマター付き Markdown ファイルからメタデータと本文を抽出し、
 * CLI オプションにマージする。
 *
 * @see Issue #1337
 */
/** コマンド種別 */
export type CommandType = "issue-create" | "issue-update" | "pr-create" | "discussion-create";
/** パースされた frontmatter 入力 */
export interface FrontmatterInput {
    /** フロントマターから抽出されたフィールド（安全フィールドのみ） */
    fields: Record<string, unknown>;
    /** フロントマター後の本文コンテンツ */
    body: string | undefined;
}
/**
 * フロントマター付きコンテンツをパースし、安全なフィールドのみ抽出する。
 *
 * @param content - フロントマター付き Markdown コンテンツ
 * @param commandType - コマンド種別（安全フィールドの決定に使用）
 * @returns パースされたフィールドと本文
 * @throws フロントマターのパースに失敗した場合
 */
export declare function parseFrontmatterInput(content: string, commandType: CommandType): FrontmatterInput;
/**
 * frontmatter から抽出した値を CLI オプションにマージする。
 * CLI フラグが既に設定されている場合はフラグを優先する（上書きしない）。
 *
 * @param frontmatterData - parseFrontmatterInput() の結果
 * @param options - 既存の CLI オプション（変更される）
 */
export declare function mergeFrontmatterOptions(frontmatterData: FrontmatterInput, options: Record<string, unknown>): void;
//# sourceMappingURL=frontmatter-input.d.ts.map