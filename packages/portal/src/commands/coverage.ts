/**
 * coverage コマンド - Jest/Istanbul カバレッジレポート可視化
 *
 * Istanbul の coverage-summary.json を解析して視覚的なダッシュボードを生成
 * CI 用の閾値チェック機能もサポート
 */

import { resolve } from "node:path";
import { loadConfig } from "../utils/config.js";
import { readFile, writeFile, fileExists } from "../utils/file.js";
import { createLogger } from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import {
  wrapHtmlDocument,
  escapeHtml,
} from "../utils/html.js";

/**
 * Istanbul coverage-summary.json のメトリクス項目
 */
export interface CoverageMetric {
  total: number;
  covered: number;
  skipped?: number;
  pct: number;
}

/**
 * Istanbul coverage-summary.json のファイルエントリ
 */
export interface IstanbulFileCoverage {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

/**
 * Istanbul coverage-summary.json 全体の型
 */
export interface IstanbulCoverageSummary {
  total?: IstanbulFileCoverage;
  [filePath: string]: IstanbulFileCoverage | undefined;
}

/**
 * 解析後のファイルカバレッジ情報
 */
export interface FileCoverage {
  path: string;
  lines: { total: number; covered: number; pct: number };
  statements: { total: number; covered: number; pct: number };
  functions: { total: number; covered: number; pct: number };
  branches: { total: number; covered: number; pct: number };
}

/**
 * 合計カバレッジ情報
 */
export interface TotalCoverage {
  lines: { total: number; covered: number; pct: number };
  statements: { total: number; covered: number; pct: number };
  functions: { total: number; covered: number; pct: number };
  branches: { total: number; covered: number; pct: number };
}

/**
 * 閾値設定
 */
export interface CoverageThresholds {
  lines?: number;
  branches?: number;
  functions?: number;
  statements?: number;
}

/**
 * 閾値チェック結果
 */
export interface CoverageCheckResult {
  passed: boolean;
  failures: string[];
}

/**
 * カバレッジステータス
 */
export type CoverageStatus = "high" | "medium" | "low";

/**
 * コマンドオプション
 */
interface CoverageOptions {
  project: string;
  config: string;
  format?: "html" | "json" | "summary";
  output?: string;
  failUnder?: number;
  verbose?: boolean;
}

/**
 * Istanbul coverage-summary.json をパースしてファイル一覧を取得
 */
export function parseIstanbulCoverage(
  json: IstanbulCoverageSummary
): FileCoverage[] {
  const files: FileCoverage[] = [];

  for (const [key, value] of Object.entries(json)) {
    // "total" エントリはスキップ
    if (key === "total" || !value) {
      continue;
    }

    files.push({
      path: key,
      lines: {
        total: value.lines.total,
        covered: value.lines.covered,
        pct: value.lines.pct,
      },
      statements: {
        total: value.statements.total,
        covered: value.statements.covered,
        pct: value.statements.pct,
      },
      functions: {
        total: value.functions.total,
        covered: value.functions.covered,
        pct: value.functions.pct,
      },
      branches: {
        total: value.branches.total,
        covered: value.branches.covered,
        pct: value.branches.pct,
      },
    });
  }

  return files;
}

/**
 * ファイル一覧から合計カバレッジを計算
 */
export function calculateTotalCoverage(files: FileCoverage[]): TotalCoverage {
  const total: TotalCoverage = {
    lines: { total: 0, covered: 0, pct: 0 },
    statements: { total: 0, covered: 0, pct: 0 },
    functions: { total: 0, covered: 0, pct: 0 },
    branches: { total: 0, covered: 0, pct: 0 },
  };

  for (const file of files) {
    total.lines.total += file.lines.total;
    total.lines.covered += file.lines.covered;
    total.statements.total += file.statements.total;
    total.statements.covered += file.statements.covered;
    total.functions.total += file.functions.total;
    total.functions.covered += file.functions.covered;
    total.branches.total += file.branches.total;
    total.branches.covered += file.branches.covered;
  }

  // パーセンテージを計算
  total.lines.pct =
    total.lines.total > 0
      ? Math.round((total.lines.covered / total.lines.total) * 100)
      : 0;
  total.statements.pct =
    total.statements.total > 0
      ? Math.round((total.statements.covered / total.statements.total) * 100)
      : 0;
  total.functions.pct =
    total.functions.total > 0
      ? Math.round((total.functions.covered / total.functions.total) * 100)
      : 0;
  total.branches.pct =
    total.branches.total > 0
      ? Math.round((total.branches.covered / total.branches.total) * 100)
      : 0;

  return total;
}

/**
 * 閾値をチェック
 */
export function checkThresholds(
  coverage: TotalCoverage,
  thresholds: CoverageThresholds
): CoverageCheckResult {
  const failures: string[] = [];

  if (thresholds.lines !== undefined && coverage.lines.pct < thresholds.lines) {
    failures.push(`lines: ${coverage.lines.pct}% < ${thresholds.lines}%`);
  }

  if (
    thresholds.statements !== undefined &&
    coverage.statements.pct < thresholds.statements
  ) {
    failures.push(
      `statements: ${coverage.statements.pct}% < ${thresholds.statements}%`
    );
  }

  if (
    thresholds.functions !== undefined &&
    coverage.functions.pct < thresholds.functions
  ) {
    failures.push(
      `functions: ${coverage.functions.pct}% < ${thresholds.functions}%`
    );
  }

  if (
    thresholds.branches !== undefined &&
    coverage.branches.pct < thresholds.branches
  ) {
    failures.push(
      `branches: ${coverage.branches.pct}% < ${thresholds.branches}%`
    );
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

/**
 * カバレッジ率からステータスを取得
 */
export function getCoverageStatus(pct: number): CoverageStatus {
  if (pct >= 90) return "high";
  if (pct >= 70) return "medium";
  return "low";
}

/**
 * カバレッジレポートをフォーマット
 */
export function formatCoverageReport(
  files: FileCoverage[],
  format: "html" | "json" | "summary"
): string {
  const total = calculateTotalCoverage(files);

  switch (format) {
    case "json":
      return formatJson(files, total);
    case "html":
      return formatHtml(files, total);
    case "summary":
    default:
      return formatSummary(files, total);
  }
}

/**
 * JSON フォーマット
 */
function formatJson(files: FileCoverage[], total: TotalCoverage): string {
  return JSON.stringify(
    {
      total,
      files: files.map((f) => ({
        path: f.path,
        lines: f.lines,
        statements: f.statements,
        functions: f.functions,
        branches: f.branches,
      })),
    },
    null,
    2
  );
}

/**
 * サマリーフォーマット
 */
function formatSummary(files: FileCoverage[], total: TotalCoverage): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("========================================");
  lines.push("        Coverage Summary");
  lines.push("========================================");
  lines.push("");
  lines.push(`Lines:      ${total.lines.covered}/${total.lines.total} (${total.lines.pct}%)`);
  lines.push(`Statements: ${total.statements.covered}/${total.statements.total} (${total.statements.pct}%)`);
  lines.push(`Functions:  ${total.functions.covered}/${total.functions.total} (${total.functions.pct}%)`);
  lines.push(`Branches:   ${total.branches.covered}/${total.branches.total} (${total.branches.pct}%)`);
  lines.push("");
  lines.push("----------------------------------------");
  lines.push(`Total Files: ${files.length}`);
  lines.push("----------------------------------------");
  lines.push("");

  // ファイル別サマリー (低カバレッジ順)
  const sortedFiles = [...files].sort((a, b) => a.lines.pct - b.lines.pct);

  for (const file of sortedFiles.slice(0, 10)) {
    const status = getCoverageStatus(file.lines.pct);
    const icon = status === "high" ? "[OK]" : status === "medium" ? "[--]" : "[!!]";
    lines.push(`${icon} ${file.path}`);
    lines.push(`    Lines: ${file.lines.pct}%  Branches: ${file.branches.pct}%  Functions: ${file.functions.pct}%`);
  }

  if (files.length > 10) {
    lines.push(`... and ${files.length - 10} more files`);
  }

  lines.push("");

  return lines.join("\n");
}

/**
 * HTML ダッシュボードフォーマット
 */
function formatHtml(files: FileCoverage[], total: TotalCoverage): string {
  const sortedFiles = [...files].sort((a, b) => a.lines.pct - b.lines.pct);

  const coverageCss = `
.coverage-dashboard {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.coverage-header {
  text-align: center;
  margin-bottom: 3rem;
}

.coverage-header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 3rem;
}

.summary-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
}

.summary-card h3 {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-card .pct {
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 0.5rem;
}

.summary-card .details {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.coverage-high { color: var(--accent-green); }
.coverage-medium { color: var(--accent-orange); }
.coverage-low { color: #ef4444; }

.progress-bar {
  height: 8px;
  background: var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 0.75rem;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-bar-fill.high { background: var(--accent-green); }
.progress-bar-fill.medium { background: var(--accent-orange); }
.progress-bar-fill.low { background: #ef4444; }

.file-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--card-bg);
  border-radius: 12px;
  overflow: hidden;
}

.file-table th,
.file-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.file-table th {
  background: var(--bg-color);
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.file-table tr:last-child td {
  border-bottom: none;
}

.file-table tr:hover {
  background: rgba(255,255,255,0.02);
}

.file-path {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.875rem;
  word-break: break-all;
}

.metric-cell {
  text-align: center;
  font-weight: 500;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-secondary);
}

.table-container {
  overflow-x: auto;
}

.sort-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0 0.25rem;
}

.sort-btn:hover {
  color: var(--text-primary);
}
`;

  const summaryCards = `
<div class="summary-cards">
  ${createSummaryCard("Lines", total.lines)}
  ${createSummaryCard("Statements", total.statements)}
  ${createSummaryCard("Functions", total.functions)}
  ${createSummaryCard("Branches", total.branches)}
</div>
`;

  const fileTableRows = sortedFiles
    .map(
      (f) => `
<tr>
  <td class="file-path">${escapeHtml(f.path)}</td>
  <td class="metric-cell ${getCoverageStatus(f.lines.pct)}">${f.lines.pct}%</td>
  <td class="metric-cell ${getCoverageStatus(f.statements.pct)}">${f.statements.pct}%</td>
  <td class="metric-cell ${getCoverageStatus(f.functions.pct)}">${f.functions.pct}%</td>
  <td class="metric-cell ${getCoverageStatus(f.branches.pct)}">${f.branches.pct}%</td>
</tr>
`
    )
    .join("");

  const fileTable = `
<div class="table-container">
  <h2 class="section-title">File Coverage</h2>
  <table class="file-table">
    <thead>
      <tr>
        <th>File</th>
        <th>Lines</th>
        <th>Statements</th>
        <th>Functions</th>
        <th>Branches</th>
      </tr>
    </thead>
    <tbody>
      ${fileTableRows}
    </tbody>
  </table>
</div>
`;

  const content = `
<div class="coverage-dashboard">
  <header class="coverage-header">
    <h1>Coverage Dashboard</h1>
    <p class="subtitle">${files.length} files analyzed</p>
  </header>
  ${summaryCards}
  ${fileTable}
  <footer>
    <p>Generated by shirokuma-flow | ${new Date().toISOString()}</p>
  </footer>
</div>
`;

  return wrapHtmlDocument({
    title: "Coverage Dashboard",
    content,
    styles: coverageCss,
  });
}

/**
 * サマリーカードを生成
 */
function createSummaryCard(
  label: string,
  metric: { total: number; covered: number; pct: number }
): string {
  const status = getCoverageStatus(metric.pct);

  return `
<div class="summary-card">
  <h3>${label}</h3>
  <div class="pct coverage-${status}">${metric.pct}%</div>
  <div class="details">${metric.covered} / ${metric.total}</div>
  <div class="progress-bar">
    <div class="progress-bar-fill ${status}" style="width: ${metric.pct}%"></div>
  </div>
</div>
`;
}

/**
 * coverage コマンドハンドラ
 */
export function coverageCommand(options: CoverageOptions): number {
  const logger = createLogger(options.verbose);
  const projectPath = resolve(options.project);

  logger.info(t("commands.coverage.generating"));

  // 設定読み込み
  const config = loadConfig(projectPath, options.config);
  const coverageConfig = config.coverage || {};

  // カバレッジファイルパスを決定
  const coverageSource =
    coverageConfig.source || "coverage/coverage-summary.json";
  const coverageFilePath = resolve(projectPath, coverageSource);

  // ファイル存在確認
  if (!fileExists(coverageFilePath)) {
    logger.error(t("commands.coverage.coverageFileNotFound", { path: coverageFilePath }));
    logger.info(t("commands.coverage.generateHint"));
    logger.info("  pnpm test -- --coverage --coverageReporters=json-summary");
    return 1;
  }

  // JSON を読み込み
  const content = readFile(coverageFilePath);
  if (!content) {
    logger.error(t("commands.coverage.coverageFileReadError", { path: coverageFilePath }));
    return 1;
  }

  let istanbulJson: IstanbulCoverageSummary;
  try {
    istanbulJson = JSON.parse(content) as IstanbulCoverageSummary;
  } catch (e) {
    logger.error(t("commands.coverage.coverageFileParseFailed", { error: String(e) }));
    return 1;
  }

  // パース
  const files = parseIstanbulCoverage(istanbulJson);
  logger.info(t("commands.coverage.analyzingCoverage", { count: files.length }));

  // 合計を計算
  const total = calculateTotalCoverage(files);

  // 閾値チェック
  const thresholds: CoverageThresholds = {
    lines: coverageConfig.thresholds?.lines,
    branches: coverageConfig.thresholds?.branches,
    functions: coverageConfig.thresholds?.functions,
    statements: coverageConfig.thresholds?.statements,
  };

  // --fail-under オプションがあれば lines 閾値として使用
  if (options.failUnder !== undefined) {
    thresholds.lines = options.failUnder;
  }

  const checkResult = checkThresholds(total, thresholds);

  // フォーマット
  const format = options.format || "summary";
  const output = formatCoverageReport(files, format);

  // 出力
  if (options.output) {
    writeFile(options.output, output);
    logger.success(t("commands.coverage.reportOutput", { path: options.output }));
  } else {
    console.log(output);
  }

  // 結果表示
  if (checkResult.passed) {
    logger.success(t("commands.coverage.allThresholdsPassed"));
  } else {
    logger.error(t("commands.coverage.thresholdsFailed"));
    for (const failure of checkResult.failures) {
      logger.error(`  - ${failure}`);
    }
  }

  // 終了コード
  const failUnder = coverageConfig.failUnder ?? false;
  if (!checkResult.passed && failUnder) {
    return 1;
  }
  return 0;
}
