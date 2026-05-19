/**
 * Output Formatters
 *
 * Provides Table JSON format for AI agent context optimization.
 * Table JSON reduces token usage by eliminating repeated key names.
 *
 * Traditional JSON:
 * ```json
 * {
 *   "issues": [
 *     {"number": 19, "title": "Fix bug", "status": "Backlog"},
 *     {"number": 20, "title": "New feature", "status": "Ready"}
 *   ]
 * }
 * ```
 *
 * Table JSON:
 * ```json
 * {
 *   "columns": ["number", "title", "status"],
 *   "rows": [
 *     [19, "Fix bug", "Backlog"],
 *     [20, "New feature", "Ready"]
 *   ]
 * }
 * ```
 */
/**
 * Table JSON output structure
 */
export interface TableJsonOutput {
    columns: string[];
    rows: unknown[][];
}
/**
 * Supported output formats
 */
export type OutputFormat = "json" | "table-json" | "frontmatter";
/**
 * Options for formatOutput function
 */
export interface FormatOptions {
    /** The key in the data object that contains the array to convert */
    arrayKey?: string;
    /** Columns to include (optional, defaults to all keys from first item) */
    columns?: string[];
}
/**
 * Convert an array of objects to Table JSON format
 *
 * @param data - Array of objects to convert
 * @param columns - Optional array of column names to include (preserves order)
 * @returns Table JSON output with columns and rows
 *
 * @example
 * ```typescript
 * const data = [
 *   { number: 19, title: "Fix bug", status: "Backlog" },
 *   { number: 20, title: "New feature", status: "Ready" },
 * ];
 *
 * const tableJson = toTableJson(data);
 * // {
 * //   columns: ["number", "title", "status"],
 * //   rows: [[19, "Fix bug", "Backlog"], [20, "New feature", "Ready"]]
 * // }
 * ```
 */
export declare function toTableJson<T extends Record<string, unknown>>(data: T[], columns?: string[]): TableJsonOutput;
/**
 * Format output data based on specified format
 *
 * @param data - Data object to format
 * @param format - Output format ("json" or "table-json")
 * @param options - Format options for table-json
 * @returns Formatted JSON string
 *
 * @example
 * ```typescript
 * const data = {
 *   repository: "owner/repo",
 *   issues: [
 *     { number: 19, title: "Fix bug" },
 *   ],
 *   total_count: 1,
 * };
 *
 * // Regular JSON
 * formatOutput(data, "json");
 *
 * // Table JSON (converts issues array)
 * formatOutput(data, "table-json", {
 *   arrayKey: "issues",
 *   columns: ["number", "title"]
 * });
 * ```
 */
export declare function formatOutput(data: Record<string, unknown>, format: OutputFormat, options?: FormatOptions): string;
/**
 * Default columns for issues list output
 */
export declare const GH_ISSUES_LIST_COLUMNS: string[];
/**
 * Default columns for projects list output
 */
export declare const GH_PROJECTS_LIST_COLUMNS: string[];
/**
 * Default columns for issues search output (#552)
 */
export declare const GH_ISSUES_SEARCH_COLUMNS: string[];
/**
 * Default columns for PR list output (#568)
 */
export declare const GH_PR_LIST_COLUMNS: string[];
/**
 * Default columns for discussions list output
 */
export declare const GH_DISCUSSIONS_LIST_COLUMNS: string[];
/**
 * Default columns for discussions search output (#553)
 */
export declare const GH_DISCUSSIONS_SEARCH_COLUMNS: string[];
/**
 * データを YAML frontmatter + Markdown body 形式にフォーマットする。
 *
 * - メタデータフィールドは YAML frontmatter (`---` 区切り) に出力
 * - `body` フィールドは frontmatter の後に Markdown として出力
 * - 内部フィールド（project_item_id, *_option_id 等）は除外
 * - `url` / `comment_url` フィールドは除外
 * - `null` / `undefined` 値のフィールドは省略
 * - 配列値は YAML フロー形式で出力
 *
 * @param data - フォーマットするデータオブジェクト
 * @returns frontmatter 文字列（オプションで body 付き）
 */
export declare function formatFrontmatter(data: Record<string, unknown>): string;
//# sourceMappingURL=formatters.d.ts.map