/**
 * lint-tests コマンド - テストドキュメントのlint
 *
 * Jest と Playwright のテストケースの @testdoc コメントをチェック
 */

import { resolve, relative } from "node:path";
import { loadConfig } from "../../utils/config.js";
import { readFile, writeFile } from "../../utils/file.js";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
import { collectJestFiles, collectPlaywrightFiles, extractTestCases } from "@shirokuma-library/portal";
import { runLint, format, defaultEnabledRules } from "../../lint/index.js";
import { determineLintExitCode } from "@shirokuma-library/lint/errors";
import type { TestCaseForLint, OutputFormat, LintOptions } from "../../lint/types.js";

/**
 * コマンドオプション
 */
interface LintTestsOptions {
  project: string;
  config: string;
  format?: OutputFormat;
  output?: string;
  strict?: boolean;
  coverageThreshold?: number;
  ignore?: string[];
  verbose?: boolean;
}

/**
 * lint-tests コマンドハンドラ
 */
export async function lintTestsCommand(options: LintTestsOptions): Promise<number> {
  const logger = createLogger(options.verbose, options.format === "json");
  const projectPath = resolve(options.project);

  logger.info(t("commands.lintTests.linting"));

  // 設定読み込み
  const config = loadConfig(projectPath, options.config);
  const testConfig = config.testCases;
  const lintConfig = config.lintTests;

  // テストファイルを収集
  const jestFiles = await collectJestFiles(projectPath, testConfig?.jest);
  const playwrightFiles = await collectPlaywrightFiles(projectPath, testConfig?.playwright);

  // 無視パターンの適用
  const ignorePatterns = options.ignore || lintConfig?.ignore || [];
  const filterIgnored = (files: string[]) =>
    files.filter((f) => !ignorePatterns.some((pattern) => f.includes(pattern)));

  const filteredJestFiles = filterIgnored(jestFiles);
  const filteredPlaywrightFiles = filterIgnored(playwrightFiles);

  logger.debug(`Jest テストファイル数: ${filteredJestFiles.length}`);
  logger.debug(`Playwright テストファイル数: ${filteredPlaywrightFiles.length}`);

  if (filteredJestFiles.length === 0 && filteredPlaywrightFiles.length === 0) {
    logger.warn(t("commands.lintTests.noTestFiles"));
    return 0;
  }

  // テストケースを抽出
  const allTestCases: TestCaseForLint[] = [];

  // Jest テストを抽出
  for (const file of filteredJestFiles) {
    const content = readFile(file);
    if (!content) continue;

    const relativePath = relative(projectPath, file);
    const cases = extractTestCases(content, relativePath, "jest");
    allTestCases.push(...cases);
  }

  // Playwright テストを抽出
  for (const file of filteredPlaywrightFiles) {
    const content = readFile(file);
    if (!content) continue;

    const relativePath = relative(projectPath, file);
    const cases = extractTestCases(content, relativePath, "playwright");
    allTestCases.push(...cases);
  }

  logger.debug(`総テストケース数: ${allTestCases.length}`);

  // ルール設定から有効なルールを取得
  const enabledRules = getEnabledRulesFromConfig(lintConfig?.rules);

  // Lintオプションを構築
  const lintOptions: LintOptions = {
    strict: options.strict ?? lintConfig?.strict ?? false,
    coverageThreshold: options.coverageThreshold ?? lintConfig?.coverageThreshold ?? 0,
    enabledRules,
  };

  // Lintを実行
  const report = runLint(allTestCases, lintOptions);

  // 出力フォーマット
  const outputFormat: OutputFormat = options.format || "terminal";
  const output = format(report, outputFormat);

  // 出力先
  if (options.output) {
    writeFile(options.output, output);
    logger.success(`レポートを出力: ${options.output}`);
  } else {
    console.log(output);
  }

  // 終了コード（lint-tests は常に strict 相当: テスト不備は常にエラー）
  if (report.passed) {
    logger.success(t("commands.lintTests.allPassed"));
  } else {
    logger.error(t("commands.lintTests.failed"));
  }
  return determineLintExitCode(report.passed, true);
}

/**
 * 設定から有効なルールを取得
 */
function getEnabledRulesFromConfig(
  rulesConfig?: Record<string, boolean | string>
): string[] {
  if (!rulesConfig) {
    return defaultEnabledRules;
  }

  return defaultEnabledRules.filter((ruleId) => {
    const setting = rulesConfig[ruleId];
    if (setting === undefined) return true; // デフォルト有効
    if (setting === false || setting === "off") return false;
    return true;
  });
}
