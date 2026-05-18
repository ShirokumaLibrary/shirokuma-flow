/**
 * JSON Formatter
 *
 * JSON出力用フォーマッター
 */

import type { LintReport } from "../types.js";

/**
 * JSON形式でフォーマット
 */
export function formatJson(report: LintReport): string {
  return JSON.stringify(report, null, 2);
}
