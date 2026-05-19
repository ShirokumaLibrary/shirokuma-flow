/**
 * フォーマッターレジストリ
 *
 * すべてのフォーマッターをエクスポート
 */
import type { LintReport, OutputFormat } from "../types.js";
/**
 * フォーマットする
 */
export declare function format(report: LintReport, outputFormat: OutputFormat): string;
export { formatTerminal } from "./terminal.js";
export { formatJson } from "./json.js";
export { formatSummary } from "./summary.js";
//# sourceMappingURL=index.d.ts.map