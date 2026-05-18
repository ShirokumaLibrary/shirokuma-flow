/**
 * Summary Formatter
 *
 * 簡潔なサマリー出力用フォーマッター
 */

import chalk from "chalk";
import type { LintReport } from "../types.js";

/**
 * サマリー形式でフォーマット
 */
export function formatSummary(report: LintReport): string {
  const lines: string[] = [];

  // ステータス（chalk.level === 0 のときは chalk が自動的にプレーンテキストを返す）
  const status = report.passed
    ? chalk.green.bold("PASS")
    : chalk.red.bold("FAIL");

  // メイン統計
  const coverage = Math.round(report.summary.coverage);
  lines.push(`${status} | ${coverage}% coverage`);
  lines.push("");

  // 詳細
  lines.push(`Files:    ${report.summary.totalFiles}`);
  lines.push(`Tests:    ${report.summary.totalTests}`);
  lines.push(`Coverage: ${coverage}%`);
  lines.push("");

  // Issue カウント
  if (report.summary.errorCount > 0) {
    lines.push(chalk.red(`Errors:   ${report.summary.errorCount}`));
  }
  if (report.summary.warningCount > 0) {
    lines.push(chalk.yellow(`Warnings: ${report.summary.warningCount}`));
  }
  if (report.summary.infoCount > 0) {
    lines.push(chalk.blue(`Info:     ${report.summary.infoCount}`));
  }

  return lines.join("\n");
}
