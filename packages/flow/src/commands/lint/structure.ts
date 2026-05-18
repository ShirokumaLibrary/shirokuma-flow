/**
 * lint-structure コマンド - プロジェクト構造検証
 *
 * Next.js/TypeScript プロジェクトのディレクトリ構造を検証
 *
 * 検証ルール:
 * - dir-required: 必須ディレクトリの存在
 * - file-required: 必須ファイルの存在
 * - lib-no-root-files: lib/ 直下のファイル禁止
 * - lib-has-index: lib/ サブディレクトリに index.ts 必須
 * - dir-recommended: 推奨ディレクトリの存在
 * - naming-convention: 命名規則
 * - no-cross-app-import: アプリ間インポート禁止
 * - actions-structure: lib/actions/ の crud/domain 構造
 * - components-domain-grouping: components/ ドメイン別グループ化
 * - lib-structure-compliance: lib/ 構造準拠（許可ディレクトリのみ）
 * - barrel-export-required: バレルエクスポート必須
 * - actions-separation: actions/ の crud/domain 分離
 *
 * @module commands/lint-structure
 */

import { resolve, join } from "node:path";
import { existsSync, readdirSync, statSync } from "node:fs";
import { loadConfig } from "../../utils/config.js";
import { writeFile } from "../../utils/file.js";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
import { stringify as yamlStringify } from "yaml";
import { determineLintExitCode } from "@shirokuma-library/lint/errors";
import type {
  LintStructureConfig,
  LintStructureReport,
  AppStructureReport,
  PackageStructureReport,
  StructureCheck,
  RecommendedAction,
  StructureSummary,
  StructureMeta,
} from "../../lint/structure-types.js";
import {
  checkDirRequired,
  checkFileRequired,
  checkLibNoRootFiles,
  checkLibHasIndex,
  checkDirRecommended,
  checkNamingConvention,
  checkNoCrossAppImport,
  checkActionsStructure,
  checkComponentsDomainGrouping,
  checkLibStructureCompliance,
  checkBarrelExportRequired,
  checkActionsSeparation,
} from "../../lint/rules/structure-rules.js";

/**
 * コマンドオプション
 */
interface LintStructureOptions {
  project: string;
  config: string;
  format?: "yaml" | "json" | "terminal";
  output?: string;
  strict?: boolean;
  verbose?: boolean;
}

/**
 * lint-structure コマンドハンドラ
 */
export function lintStructureCommand(
  options: LintStructureOptions
): number {
  const logger = createLogger(options.verbose, options.format === "json");
  const projectPath = resolve(options.project);

  logger.info(t("commands.lintStructure.validating"));

  // 設定読み込み
  const config = loadConfig(projectPath, options.config);
  const lintStructureConfig = config.lintStructure as
    | LintStructureConfig
    | undefined;

  if (!lintStructureConfig?.enabled) {
    // enabled: false が明示的に設定されている場合はサイレントスキップ
    if (!lintStructureConfig || lintStructureConfig.enabled === undefined) {
      logger.warn("lint-structure is not enabled in config. Add 'lintStructure: { enabled: true }' to .shirokuma/config.yaml");
    }
    return 0;
  }

  const strict = options.strict ?? lintStructureConfig.strict ?? false;

  // 検証実行
  const report = runLintStructure(projectPath, lintStructureConfig, config.project?.name || "unknown");

  // 出力フォーマット
  const outputFormat = options.format || "yaml";
  const output = formatReport(report, outputFormat);

  // 出力先
  if (options.output) {
    writeFile(options.output, output);
    logger.success(`レポートを出力: ${options.output}`);
  } else {
    console.log(output);
  }

  // 終了コード
  if (report.summary.passed) {
    logger.success(t("commands.lintStructure.allPassed"));
  } else if (strict) {
    logger.error(`構造検証失敗 - ${report.summary.errors}件のエラー`);
  } else {
    logger.warn(
      `構造検証完了 - ${report.summary.errors}件のエラー（non-strictモード）`
    );
  }
  return determineLintExitCode(report.summary.passed, strict);
}

/**
 * lint-structure を実行
 */
function runLintStructure(
  projectPath: string,
  config: LintStructureConfig,
  projectName: string
): LintStructureReport {
  const rules = config.rules || {};

  // apps/ 検出
  const appsPath = join(projectPath, "apps");
  const apps: AppStructureReport[] = [];

  if (existsSync(appsPath)) {
    const excludeApps = config.excludeApps || [];
    const appDirs = readdirSync(appsPath)
      .filter((name) => statSync(join(appsPath, name)).isDirectory())
      .filter((name) => !excludeApps.includes(name));

    for (const appName of appDirs) {
      const appPath = join(appsPath, appName);
      const checks = runAppChecks(projectPath, appName, appPath, rules);

      const hasErrors = checks.some((c) => c.status === "error");
      apps.push({
        name: appName,
        path: `apps/${appName}`,
        passed: !hasErrors,
        checks,
      });
    }
  }

  // packages/ 検出
  const packagesPath = join(projectPath, "packages");
  const packages: PackageStructureReport[] = [];

  if (existsSync(packagesPath)) {
    const pkgDirs = readdirSync(packagesPath).filter((name) =>
      statSync(join(packagesPath, name)).isDirectory()
    );

    for (const pkgName of pkgDirs) {
      const pkgPath = join(packagesPath, pkgName);
      const checks = runPackageChecks(pkgPath, pkgName, rules);

      const hasErrors = checks.some((c) => c.status === "error");
      packages.push({
        name: pkgName,
        path: `packages/${pkgName}`,
        passed: !hasErrors,
        checks,
      });
    }
  }

  // サマリー計算
  const allChecks = [
    ...apps.flatMap((a) => a.checks),
    ...packages.flatMap((p) => p.checks),
  ];

  const errors = allChecks.filter((c) => c.status === "error").length;
  const warnings = allChecks.filter((c) => c.status === "warning").length;
  const info = allChecks.filter((c) => c.status === "info").length;

  const summary: StructureSummary = {
    passed: errors === 0,
    totalChecks: allChecks.length,
    errors,
    warnings,
    info,
  };

  // 推奨アクション生成
  const recommendedActions = generateRecommendedActions(allChecks);

  // メタ情報
  const meta: StructureMeta = {
    command: "lint-structure",
    project: projectName,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
  };

  return {
    meta,
    summary,
    apps,
    packages,
    recommendedActions,
  };
}

/**
 * アプリの構造チェックを実行
 */
function runAppChecks(
  projectPath: string,
  appName: string,
  appPath: string,
  rules: LintStructureConfig["rules"]
): StructureCheck[] {
  const checks: StructureCheck[] = [];

  // 1. 必須ディレクトリ
  if (rules?.["dir-required"]) {
    const dirConfig = rules["dir-required"];
    const dirs = dirConfig.apps || [];
    checks.push(...checkDirRequired(appPath, dirs, dirConfig.severity));
  }

  // 2. 必須ファイル
  if (rules?.["file-required"]) {
    const fileConfig = rules["file-required"];
    const files = fileConfig.apps || [];
    checks.push(...checkFileRequired(appPath, files, fileConfig.severity));
  }

  // 3. lib/ 直下ファイル禁止
  if (rules?.["lib-no-root-files"]) {
    checks.push(...checkLibNoRootFiles(appPath, rules["lib-no-root-files"]));
  }

  // 4. lib/ サブディレクトリに index.ts 必須
  if (rules?.["lib-has-index"]) {
    checks.push(...checkLibHasIndex(appPath, rules["lib-has-index"]));
  }

  // 5. 推奨ディレクトリ
  if (rules?.["dir-recommended"]) {
    const recConfig = rules["dir-recommended"];
    const dirs = recConfig.apps || [];
    checks.push(...checkDirRecommended(appPath, dirs, recConfig.severity));
  }

  // 6. 命名規則
  if (rules?.["naming-convention"]) {
    checks.push(...checkNamingConvention(appPath, rules["naming-convention"]));
  }

  // 7. Cross-app import 禁止
  if (rules?.["no-cross-app-import"]) {
    checks.push(
      ...checkNoCrossAppImport(projectPath, appName, rules["no-cross-app-import"])
    );
  }

  // 8. actions/ 構造チェック
  checks.push(...checkActionsStructure(appPath, "info"));

  // 9. components/ ドメイン別グループ化
  if (rules?.["components-domain-grouping"]) {
    checks.push(
      ...checkComponentsDomainGrouping(appPath, rules["components-domain-grouping"])
    );
  }

  // 10. lib/ 構造準拠チェック
  if (rules?.["lib-structure-compliance"]) {
    checks.push(
      ...checkLibStructureCompliance(appPath, rules["lib-structure-compliance"])
    );
  }

  // 11. バレルエクスポート必須チェック
  if (rules?.["barrel-export-required"]) {
    checks.push(
      ...checkBarrelExportRequired(appPath, rules["barrel-export-required"])
    );
  }

  // 12. actions分離チェック
  if (rules?.["actions-separation"]) {
    checks.push(
      ...checkActionsSeparation(appPath, rules["actions-separation"])
    );
  }

  return checks;
}

/**
 * パッケージの構造チェックを実行
 */
function runPackageChecks(
  pkgPath: string,
  pkgName: string,
  rules: LintStructureConfig["rules"]
): StructureCheck[] {
  const checks: StructureCheck[] = [];

  // パッケージ固有の必須ディレクトリ
  if (rules?.["dir-required"]?.packages?.[pkgName]) {
    const dirs = rules["dir-required"].packages[pkgName];
    checks.push(...checkDirRequired(pkgPath, dirs, rules["dir-required"].severity));
  }

  // パッケージ固有の必須ファイル
  if (rules?.["file-required"]?.packages?.[pkgName]) {
    const files = rules["file-required"].packages[pkgName];
    checks.push(
      ...checkFileRequired(pkgPath, files, rules["file-required"].severity)
    );
  }

  return checks;
}

/**
 * 推奨アクションを生成
 */
function generateRecommendedActions(checks: StructureCheck[]): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  let priority = 1;

  // エラーを優先
  const errors = checks.filter((c) => c.status === "error" && c.fix);
  for (const error of errors) {
    actions.push({
      priority: priority++,
      action: error.fix!,
      reason: error.message || "構造エラー",
      rule: error.rule,
      target: error.target,
    });
  }

  // 次にワーニング
  const warnings = checks.filter((c) => c.status === "warning" && c.fix);
  for (const warning of warnings) {
    actions.push({
      priority: priority++,
      action: warning.fix!,
      reason: warning.message || "推奨事項",
      rule: warning.rule,
      target: warning.target,
    });
  }

  return actions;
}

/**
 * レポートをフォーマット
 */
function formatReport(
  report: LintStructureReport,
  format: "yaml" | "json" | "terminal"
): string {
  if (format === "json") {
    return JSON.stringify(report, null, 2);
  }

  if (format === "terminal") {
    return formatTerminal(report);
  }

  // YAML フォーマット (デフォルト)
  return yamlStringify(report, {
    indent: 2,
    lineWidth: 120,
  });
}

/**
 * ターミナルフォーマット
 */
function formatTerminal(report: LintStructureReport): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("Project Structure Validation");
  lines.push("=".repeat(60));
  lines.push("");

  // Apps
  if (report.apps.length > 0) {
    lines.push("## Apps");
    lines.push("");
    for (const app of report.apps) {
      const icon = app.passed ? "\u2705" : "\u274C";
      lines.push(`${icon} ${app.path}`);

      const issues = app.checks.filter((c) => c.status !== "pass");
      for (const issue of issues) {
        const issueIcon =
          issue.status === "error"
            ? "\u274C"
            : issue.status === "warning"
              ? "\u26A0\uFE0F"
              : "\u2139\uFE0F";
        lines.push(`   ${issueIcon} [${issue.rule}] ${issue.target}`);
        if (issue.message) {
          lines.push(`      ${issue.message}`);
        }
      }
      lines.push("");
    }
  }

  // Packages
  if (report.packages.length > 0) {
    lines.push("## Packages");
    lines.push("");
    for (const pkg of report.packages) {
      const icon = pkg.passed ? "\u2705" : "\u274C";
      lines.push(`${icon} ${pkg.path}`);

      const issues = pkg.checks.filter((c) => c.status !== "pass");
      for (const issue of issues) {
        const issueIcon =
          issue.status === "error"
            ? "\u274C"
            : issue.status === "warning"
              ? "\u26A0\uFE0F"
              : "\u2139\uFE0F";
        lines.push(`   ${issueIcon} [${issue.rule}] ${issue.target}`);
        if (issue.message) {
          lines.push(`      ${issue.message}`);
        }
      }
      lines.push("");
    }
  }

  // Summary
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("Summary:");
  lines.push(`  Total Checks:  ${report.summary.totalChecks}`);
  lines.push(`  \u274C Errors:      ${report.summary.errors}`);
  lines.push(`  \u26A0\uFE0F  Warnings:    ${report.summary.warnings}`);
  lines.push(`  \u2139\uFE0F  Info:        ${report.summary.info}`);
  lines.push("");
  lines.push(report.summary.passed ? "\u2705 PASSED" : "\u274C FAILED");
  lines.push("");

  // Recommended Actions
  if (report.recommendedActions.length > 0) {
    lines.push("Recommended Actions:");
    lines.push("");
    for (const action of report.recommendedActions.slice(0, 5)) {
      lines.push(`  ${action.priority}. [${action.rule}] ${action.target}`);
      lines.push(`     Action: ${action.action}`);
      lines.push(`     Reason: ${action.reason}`);
      lines.push("");
    }
    if (report.recommendedActions.length > 5) {
      lines.push(`  ... and ${report.recommendedActions.length - 5} more`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
