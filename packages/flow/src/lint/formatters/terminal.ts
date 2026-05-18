/**
 * Terminal Formatter
 *
 * 色付きターミナル出力用フォーマッター
 */

import chalk from "chalk";
import type { LintReport, Severity } from "../types.js";

/**
 * 重大度に応じた色を取得
 */
function getSeverityColor(severity: Severity): (text: string) => string {
  switch (severity) {
    case "error":
      return chalk.red;
    case "warning":
      return chalk.yellow;
    case "info":
      return chalk.blue;
    default:
      return chalk.white;
  }
}

/**
 * 重大度に応じたシンボルを取得
 */
function getSeveritySymbol(severity: Severity): string {
  switch (severity) {
    case "error":
      return "x";
    case "warning":
      return "!";
    case "info":
      return "i";
    default:
      return "-";
  }
}

/**
 * ターミナル出力をフォーマット
 */
export function formatTerminal(report: LintReport): string {
  const lines: string[] = [];

  // ヘッダー
  lines.push("");
  lines.push(chalk.bold("Test Documentation Lint Results"));
  lines.push(chalk.gray("=".repeat(50)));
  lines.push("");

  // ファイル別の結果（issue があるファイルのみ表示）
  for (const result of report.results) {
    if (result.issues.length === 0) {
      continue;
    }
    lines.push(
      chalk.yellow("warn ") + chalk.white(result.file) + chalk.gray(` (${result.totalTests} tests)`)
    );

    for (const issue of result.issues) {
      const color = getSeverityColor(issue.severity);
      const symbol = getSeveritySymbol(issue.severity);
      lines.push(
        `  ${color(symbol)} ${chalk.gray(`L${issue.line}:`)} ${issue.message} ${chalk.gray(`(${issue.rule})`)}`
      );
    }
    lines.push("");
  }

  // サマリー
  lines.push("");
  lines.push(chalk.gray("-".repeat(50)));
  lines.push(chalk.bold("Summary"));
  lines.push("");

  const statsLine = [
    `${report.summary.totalFiles} files`,
    `${report.summary.totalTests} tests`,
    `${report.summary.testsWithTestdoc} with @testdoc`,
    chalk.bold(`${report.summary.coverage}% coverage`),
  ].join(" | ");
  lines.push(statsLine);

  // Issue counts
  const issueStats: string[] = [];
  if (report.summary.errorCount > 0) {
    issueStats.push(chalk.red(`${report.summary.errorCount} errors`));
  }
  if (report.summary.warningCount > 0) {
    issueStats.push(chalk.yellow(`${report.summary.warningCount} warnings`));
  }
  if (report.summary.infoCount > 0) {
    issueStats.push(chalk.blue(`${report.summary.infoCount} info`));
  }
  if (issueStats.length > 0) {
    lines.push(issueStats.join(" | "));
  }

  // 結果
  lines.push("");
  if (report.passed) {
    lines.push(chalk.green.bold("PASS") + " - All checks passed");
  } else {
    lines.push(chalk.red.bold("FAIL") + " - Some checks failed");
  }
  lines.push("");

  return lines.join("\n");
}
