/**
 * sanitize - 入力サニタイズユーティリティ
 *
 * 外部入力を安全に扱うための共通関数群。GitHub search クエリ構築用の
 * `stripDoubleQuotes` のみ flow ローカル定義し、`escapeRegExp` /
 * `safeRegExp` / `validateProjectPath` は `@shirokuma-library/lint/sanitize`
 * から re-export する。
 */

export { escapeRegExp, safeRegExp, validateProjectPath } from "@shirokuma-library/lint/sanitize";

/**
 * ダブルクォートを除去
 *
 * GitHub search の `category:"..."` 等、クォート内に埋め込む値から
 * ダブルクォートを除去し、構文破壊を防ぐ。
 */
export function stripDoubleQuotes(str: string): string {
  return str.replace(/"/g, "");
}
