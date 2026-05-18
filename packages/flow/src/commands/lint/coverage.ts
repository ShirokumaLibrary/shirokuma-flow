/**
 * lint-coverage コマンド - 実装-テスト対応チェック
 *
 * 規約ベースでソースファイルとテストファイルの対応を検証
 * @skip-test アノテーションによる例外指定をサポート
 */

import { resolve, relative, basename, dirname, join } from "node:path";
import { globSync } from "glob";
import { loadConfig } from "../../utils/config.js";
import { readFile, writeFile } from "../../utils/file.js";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
import { safeRegExp } from "../../utils/sanitize.js";
import { determineLintExitCode } from "@shirokuma-library/lint/errors";
import type {
  CoverageConfig,
  CoverageReport,
  FileCoverageResult,
  OrphanTestResult,
  SkipTestAnnotation,
  ConventionMapping,
} from "../../lint/coverage-types.js";
import {
  defaultConventions,
  defaultExcludes,
} from "../../lint/coverage-types.js";

/**
 * コマンドオプション
 */
interface LintCoverageOptions {
  project: string;
  config: string;
  format?: "terminal" | "json" | "summary";
  output?: string;
  strict?: boolean;
  verbose?: boolean;
}

/**
 * lint-coverage コマンドハンドラ
 */
export function lintCoverageCommand(options: LintCoverageOptions): number {
  const logger = createLogger(options.verbose, options.format === "json");
  const projectPath = resolve(options.project);

  logger.info(t("commands.lintCoverage.checking"));

  // 設定読み込み
  const config = loadConfig(projectPath, options.config);
  const coverageConfig: CoverageConfig = config.lintCoverage || {};

  // 規約マッピングを取得
  const conventions = coverageConfig.conventions || defaultConventions;
  const excludes = coverageConfig.exclude || defaultExcludes;
  const strict = options.strict ?? coverageConfig.strict ?? true;

  logger.debug(`規約数: ${conventions.length}`);
  logger.debug(`除外パターン数: ${excludes.length}`);

  // ソースファイルを収集
  const sourceFiles = collectSourceFiles(projectPath, conventions, excludes);
  logger.debug(`ソースファイル数: ${sourceFiles.length}`);

  // テストファイルを収集
  const testFiles = collectTestFiles(projectPath, conventions);
  logger.debug(`テストファイル数: ${testFiles.size}`);

  // 対応チェック
  const report = checkCoverage(
    projectPath,
    sourceFiles,
    testFiles,
    conventions,
    coverageConfig.requireSkipReason ?? true
  );

  // 出力フォーマット
  const outputFormat = options.format || "terminal";
  const output = formatReport(report, outputFormat);

  // 出力先
  if (options.output) {
    writeFile(options.output, output);
    logger.success(`レポートを出力: ${options.output}`);
  } else {
    console.log(output);
  }

  // 終了コード
  if (report.passed) {
    logger.success(t("commands.lintCoverage.allPassed"));
  } else if (strict) {
    logger.error(`チェック失敗 - ${report.summary.missingCount}ファイルが未テスト`);
  } else {
    logger.warn(`チェック完了 - ${report.summary.missingCount}ファイルが未テスト`);
  }
  return determineLintExitCode(report.passed, strict);
}

/**
 * Programmatic interface for running lint-coverage
 * Used by portal command to generate coverage.json
 */
export interface RunLintCoverageOptions {
  projectPath: string;
  configPath?: string;
}

export function runLintCoverage(options: RunLintCoverageOptions): CoverageReport {
  const { projectPath, configPath } = options;
  const resolvedPath = resolve(projectPath);

  // 設定読み込み
  const config = loadConfig(resolvedPath, configPath || ".shirokuma/config.yaml");
  const coverageConfig: CoverageConfig = config.lintCoverage || {};

  // 規約マッピングを取得
  const conventions = coverageConfig.conventions || defaultConventions;
  const excludes = coverageConfig.exclude || defaultExcludes;

  // ソースファイルを収集
  const sourceFiles = collectSourceFiles(resolvedPath, conventions, excludes);

  // テストファイルを収集
  const testFiles = collectTestFiles(resolvedPath, conventions);

  // 対応チェック
  const report = checkCoverage(
    resolvedPath,
    sourceFiles,
    testFiles,
    conventions,
    coverageConfig.requireSkipReason ?? true
  );

  return report;
}

/**
 * ソースファイルを収集
 */
function collectSourceFiles(
  projectPath: string,
  conventions: ConventionMapping[],
  excludes: string[]
): string[] {
  const allFiles = new Set<string>();

  for (const conv of conventions) {
    const pattern = join(projectPath, "**", conv.source);
    const files = globSync(pattern, {
      ignore: excludes.map((e) => join(projectPath, "**", e)),
      nodir: true,
    });

    for (const file of files) {
      allFiles.add(relative(projectPath, file));
    }
  }

  return Array.from(allFiles).sort();
}

/**
 * テストファイルを収集
 */
function collectTestFiles(
  projectPath: string,
  conventions: ConventionMapping[]
): Map<string, number> {
  const testFiles = new Map<string, number>();

  for (const conv of conventions) {
    const pattern = join(projectPath, "**", conv.test);
    const files = globSync(pattern, { nodir: true });

    for (const file of files) {
      const relativePath = relative(projectPath, file);
      const content = readFile(file);
      const testCount = countTests(content || "");
      testFiles.set(relativePath, testCount);
    }
  }

  return testFiles;
}

/**
 * テスト数をカウント
 */
function countTests(content: string): number {
  const itMatches = content.match(/\bit\s*\(/g) || [];
  const testMatches = content.match(/\btest\s*\(/g) || [];
  return itMatches.length + testMatches.length;
}

/**
 * @skip-test アノテーションを抽出
 */
function extractSkipTest(content: string): SkipTestAnnotation | undefined {
  // JSDocコメントから @skip-test を探す
  const skipTestMatch = content.match(/@skip-test\s+(.+?)(?:\n|\*\/)/);
  if (!skipTestMatch) return undefined;

  const reason = skipTestMatch[1].trim();

  // @see 参照を探す
  const seeMatch = content.match(/@see\s+(\S+)/);
  const seeReference = seeMatch ? seeMatch[1] : undefined;

  return { reason, seeReference };
}

/**
 * ソースパスから期待されるテストパスを生成
 */
function getExpectedTestPath(
  sourcePath: string,
  conventions: ConventionMapping[]
): string | undefined {
  for (const conv of conventions) {
    // source パターンにマッチするかチェック
    const sourcePattern = conv.source.replace(/\*\*/g, "(.*)").replace(/\*/g, "([^/]*)");
    const sourceRegex = safeRegExp(`^${sourcePattern}$`);
    if (!sourceRegex) continue;
    const match = sourcePath.match(sourceRegex);

    if (match) {
      // テストパスを生成
      let testPath = conv.test;
      let index = 1;
      testPath = testPath.replace(/\*\*/g, () => match[index++] || "");
      testPath = testPath.replace(/\*/g, () => match[index++] || "");

      // ファイル名を調整 (foo.ts -> foo.test.ts)
      const dir = dirname(testPath);
      const name = basename(sourcePath, ".ts").replace(".tsx", "");
      return join(dir, `${name}.test.ts`);
    }
  }

  return undefined;
}

/**
 * テストパスから期待されるソースパスを生成
 */
function getExpectedSourcePath(
  testPath: string,
  conventions: ConventionMapping[]
): string | undefined {
  for (const conv of conventions) {
    const testPattern = conv.test.replace(/\*\*/g, "(.*)").replace(/\*/g, "([^/]*)");
    const testRegex = safeRegExp(`^${testPattern.replace(".test.ts", "\\.test\\.tsx?")}$`);
    if (!testRegex) continue;

    // 正規化されたパスでマッチ
    const normalizedTestPath = testPath.replace(/\.test\.tsx?$/, ".test.ts");
    const match = normalizedTestPath.match(testRegex);

    if (match) {
      // ソースパスを生成
      let sourcePath = conv.source;
      let index = 1;
      sourcePath = sourcePath.replace(/\*\*/g, () => match[index++] || "");
      sourcePath = sourcePath.replace(/\*/g, () => match[index++] || "");

      // ファイル名を調整 (foo.test.ts -> foo.ts)
      const dir = dirname(sourcePath);
      const name = basename(testPath).replace(/\.test\.tsx?$/, "");
      return join(dir, `${name}.ts`);
    }
  }

  return undefined;
}

/**
 * 対応チェックを実行
 */
function checkCoverage(
  projectPath: string,
  sourceFiles: string[],
  testFilesMap: Map<string, number>,
  conventions: ConventionMapping[],
  _requireSkipReason: boolean
): CoverageReport {
  const results: FileCoverageResult[] = [];
  const orphans: OrphanTestResult[] = [];
  const matchedTestFiles = new Set<string>();

  // 各ソースファイルをチェック
  for (const sourcePath of sourceFiles) {
    const fullPath = join(projectPath, sourcePath);
    const content = readFile(fullPath) || "";

    // @skip-test チェック
    const skipTest = extractSkipTest(content);
    if (skipTest) {
      results.push({
        source: sourcePath,
        testCount: 0,
        status: "skipped",
        skipReason: skipTest.reason,
        seeReference: skipTest.seeReference,
      });
      continue;
    }

    // 期待されるテストパスを取得
    const expectedTestPath = getExpectedTestPath(sourcePath, conventions);

    // 実際のテストファイルを探す
    let foundTestPath: string | undefined;
    let foundTestCount = 0;

    if (expectedTestPath) {
      // 完全一致を試す
      for (const [testPath, testCount] of testFilesMap) {
        if (testPath === expectedTestPath || testPath.endsWith(basename(expectedTestPath))) {
          foundTestPath = testPath;
          foundTestCount = testCount;
          matchedTestFiles.add(testPath);
          break;
        }
      }
    }

    // 部分一致を試す (ファイル名ベース)
    if (!foundTestPath) {
      const sourceBaseName = basename(sourcePath, ".ts").replace(".tsx", "");
      const expectedTestName = `${sourceBaseName}.test.ts`;

      for (const [testPath, testCount] of testFilesMap) {
        if (basename(testPath) === expectedTestName || basename(testPath) === `${sourceBaseName}.test.tsx`) {
          foundTestPath = testPath;
          foundTestCount = testCount;
          matchedTestFiles.add(testPath);
          break;
        }
      }
    }

    if (foundTestPath) {
      results.push({
        source: sourcePath,
        test: foundTestPath,
        testCount: foundTestCount,
        status: "covered",
      });
    } else {
      results.push({
        source: sourcePath,
        testCount: 0,
        status: "missing",
      });
    }
  }

  // 孤立テストを検出
  for (const [testPath] of testFilesMap) {
    if (!matchedTestFiles.has(testPath)) {
      const expectedSource = getExpectedSourcePath(testPath, conventions);
      if (expectedSource) {
        orphans.push({
          test: testPath,
          expectedSource,
        });
      }
    }
  }

  // サマリーを計算
  const totalSources = results.length;
  const coveredCount = results.filter((r) => r.status === "covered").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const missingCount = results.filter((r) => r.status === "missing").length;
  const orphanCount = orphans.length;
  const coveragePercent =
    totalSources > 0 ? Math.round(((coveredCount + skippedCount) / totalSources) * 100) : 100;

  return {
    results,
    orphans,
    summary: {
      totalSources,
      coveredCount,
      skippedCount,
      missingCount,
      orphanCount,
      coveragePercent,
    },
    passed: missingCount === 0,
  };
}

/**
 * レポートをフォーマット
 */
function formatReport(
  report: CoverageReport,
  format: "terminal" | "json" | "summary"
): string {
  if (format === "json") {
    return JSON.stringify(report, null, 2);
  }

  if (format === "summary") {
    return formatSummary(report);
  }

  return formatTerminal(report);
}

/**
 * サマリーフォーマット
 */
function formatSummary(report: CoverageReport): string {
  const { summary } = report;
  const lines: string[] = [
    "",
    `Coverage: ${summary.coveragePercent}%`,
    `  Covered:  ${summary.coveredCount}`,
    `  Skipped:  ${summary.skippedCount}`,
    `  Missing:  ${summary.missingCount}`,
    `  Orphans:  ${summary.orphanCount}`,
    "",
    report.passed ? "PASSED" : "FAILED",
    "",
  ];

  return lines.join("\n");
}

/**
 * ターミナルフォーマット
 */
function formatTerminal(report: CoverageReport): string {
  const lines: string[] = [];

  // ヘッダー
  lines.push("");
  lines.push("📊 Coverage Report");
  lines.push("━".repeat(60));
  lines.push("");

  // 結果
  for (const result of report.results) {
    const icon = getStatusIcon(result.status);
    const testInfo = result.test
      ? `→ ${result.test} (${result.testCount} tests)`
      : result.status === "skipped"
      ? `→ スキップ (${result.skipReason})`
      : "→ ❌ テストファイルなし";

    lines.push(`${icon} ${result.source}`);
    lines.push(`   ${testInfo}`);

    if (result.seeReference) {
      lines.push(`   📎 参照: ${result.seeReference}`);
    }
  }

  // 孤立テスト
  if (report.orphans.length > 0) {
    lines.push("");
    lines.push("💡 孤立テストファイル:");
    for (const orphan of report.orphans) {
      lines.push(`   ${orphan.test}`);
      lines.push(`   → 期待される実装: ${orphan.expectedSource}`);
    }
  }

  // サマリー
  lines.push("");
  lines.push("━".repeat(60));
  lines.push("");
  lines.push(`Summary:`);
  lines.push(`  実装ファイル:     ${report.summary.totalSources}`);
  lines.push(`  ✅ テスト済み:    ${report.summary.coveredCount}`);
  lines.push(`  ⏭️ スキップ:       ${report.summary.skippedCount}`);
  lines.push(`  ❌ 未テスト:       ${report.summary.missingCount}`);
  lines.push(`  💡 孤立テスト:     ${report.summary.orphanCount}`);
  lines.push("");
  lines.push(`カバレッジ: ${report.summary.coveragePercent}%`);
  lines.push("");
  lines.push(report.passed ? "✅ PASSED" : "❌ FAILED");
  lines.push("");

  return lines.join("\n");
}

/**
 * ステータスアイコンを取得
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case "covered":
      return "✅";
    case "skipped":
      return "⏭️";
    case "missing":
      return "❌";
    default:
      return "❓";
  }
}
