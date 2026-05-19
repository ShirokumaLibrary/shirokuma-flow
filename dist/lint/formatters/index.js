/**
 * フォーマッターレジストリ
 *
 * すべてのフォーマッターをエクスポート
 */
import { formatTerminal } from "./terminal.js";
import { formatJson } from "./json.js";
import { formatSummary } from "./summary.js";
/**
 * フォーマットする
 */
export function format(report, outputFormat) {
    switch (outputFormat) {
        case "terminal":
            return formatTerminal(report);
        case "json":
            return formatJson(report);
        case "summary":
            return formatSummary(report);
        default:
            return formatTerminal(report);
    }
}
// 個別フォーマッターのエクスポート
export { formatTerminal } from "./terminal.js";
export { formatJson } from "./json.js";
export { formatSummary } from "./summary.js";
//# sourceMappingURL=index.js.map