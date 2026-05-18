/**
 * lint-annotations コマンド - アノテーション整合性検証
 *
 * コードアノテーションの整合性を検証:
 * - @usedComponents: インポートとの整合性チェック
 * - @screen: page.tsx での存在チェック
 * - @component: components/*.tsx での存在チェック
 *
 * @module commands/lint-annotations
 */

import { resolve, relative } from "node:path";
import { globSync } from "glob";
import { loadConfig, resolvePath } from "../../utils/config.js";
import { readFile, writeFile } from "../../utils/file.js";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
import { determineLintExitCode } from "@shirokuma-library/lint/errors";
import {
  extractUsedComponentsAnnotation,
  extractComponentsFromImports,
  compareUsedComponents,
  checkScreenAnnotation,
  checkComponentAnnotation,
  applyFixes,
} from "../../lint/annotation-lint.js";
import type {
  LintAnnotationsConfig,
  LintAnnotationsReport,
  FileAnnotationReport,
  AnnotationIssue,
} from "../../lint/annotation-types.js";

/**
 * コマンドオプション
 */
interface LintAnnotationsOptions {
  project: string;
  config: string;
  format?: "terminal" | "json" | "summary";
  output?: string;
  strict?: boolean;
  verbose?: boolean;
  fix?: boolean;
}

/**
 * 修正結果の型
 */
interface FixResultSummary {
  file: string;
  fixed: boolean;
  changes: string[];
}

/**
 * デフォルト設定
 */
const defaultConfig: LintAnnotationsConfig = {
  enabled: true,
  strict: false,
  rules: {
    "usedComponents-match": {
      severity: "warning",
      checkOrder: false,
      excludeHooks: true,
    },
    "screen-required": {
      severity: "warning",
      paths: ["apps/*/app/**/page.tsx"],
      exclude: ["**/not-found.tsx", "**/error.tsx", "**/loading.tsx"],
    },
    "component-required": {
      severity: "info",
      paths: ["apps/*/components/**/*.tsx"],
      exclude: ["**/components/ui/**", "**/providers/**"],
    },
  },
  exclude: ["**/node_modules/**", "**/__tests__/**"],
};

/**
 * lint-annotations コマンドハンドラ
 */
export function lintAnnotationsCommand(
  options: LintAnnotationsOptions
): number {
  const logger = createLogger(options.verbose, options.format === "json");
  const projectPath = resolve(options.project);

  if (options.fix) {
    logger.info(t("commands.lintAnnotations.fixing"));
  } else {
    logger.info(t("commands.lintAnnotations.validating"));
  }

  // 設定読み込み
  const config = loadConfig(projectPath, options.config);
  const lintConfig = (config as { lintAnnotations?: LintAnnotationsConfig })
    .lintAnnotations ?? defaultConfig;

  if (!lintConfig.enabled) {
    logger.warn("lint-annotations is not enabled in config. Add 'lintAnnotations: { enabled: true }' to .shirokuma/config.yaml");
    return 0;
  }

  const strict = options.strict ?? lintConfig.strict ?? false;

  // --fix オプションが指定された場合
  if (options.fix) {
    const fixResults = runFixAnnotations(projectPath, lintConfig, logger);

    // 修正結果を出力
    const fixedCount = fixResults.filter((r) => r.fixed).length;
    if (fixedCount > 0) {
      logger.success(`${fixedCount}ファイルを修正しました`);
      for (const result of fixResults) {
        if (result.fixed) {
          logger.info(`  ${result.file}: ${result.changes.join(", ")}`);
        }
      }
    } else {
      logger.info(t("commands.lintAnnotations.noFixNeeded"));
    }

    return 0;
  }

  // 検証実行
  const report = runLintAnnotations(projectPath, lintConfig, logger);

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
    logger.success(t("commands.lintAnnotations.allPassed"));
  } else if (strict) {
    logger.error(
      `アノテーション検証失敗 - ${report.summary.errorCount}件のエラー`
    );
  } else {
    logger.warn(
      `アノテーション検証完了 - ${report.summary.errorCount + report.summary.warningCount}件の問題（non-strictモード）`
    );
  }
  return determineLintExitCode(report.passed, strict);
}

/**
 * アノテーションを自動修正
 */
function runFixAnnotations(
  projectPath: string,
  config: LintAnnotationsConfig,
  logger: ReturnType<typeof createLogger>
): FixResultSummary[] {
  const results: FixResultSummary[] = [];

  // Screen files (page.tsx)
  const screenRule = config.rules["screen-required"];
  if (screenRule) {
    const screenPaths = screenRule.paths || ["apps/*/app/**/page.tsx"];
    for (const pattern of screenPaths) {
      const fullPattern = resolvePath(projectPath, pattern);
      const files = globSync(fullPattern, { nodir: true });

      logger.info(`Screen files: ${files.length} files matching ${pattern}`);

      for (const file of files) {
        const relativePath = relative(projectPath, file);
        const content = readFile(file);
        if (!content) continue;

        // 除外ファイルをスキップ
        const exclude = screenRule.exclude || [];
        const isExcluded = exclude.some((pattern) =>
          relativePath.includes(pattern.replace(/\*\*/g, "").replace(/\*/g, ""))
        );
        if (isExcluded) continue;

        // 修正を適用
        const fixResult = applyFixes(content, relativePath, {
          fixUsedComponents: !!config.rules["usedComponents-match"],
          fixScreen: true,
          fixRoute: true,
        });

        if (fixResult.changed) {
          // ファイルを書き込み
          writeFile(file, fixResult.content);
          results.push({
            file: relativePath,
            fixed: true,
            changes: fixResult.changes,
          });
        }
      }
    }
  }

  // Component files
  const componentRule = config.rules["component-required"];
  if (componentRule) {
    const componentPaths =
      componentRule.paths || ["apps/*/components/**/*.tsx"];
    for (const pattern of componentPaths) {
      const fullPattern = resolvePath(projectPath, pattern);
      const files = globSync(fullPattern, { nodir: true });

      logger.info(
        `Component files: ${files.length} files matching ${pattern}`
      );

      for (const file of files) {
        const relativePath = relative(projectPath, file);
        const content = readFile(file);
        if (!content) continue;

        // 除外ファイルをスキップ
        const exclude = componentRule.exclude || [];
        const isExcluded = exclude.some((pattern) => {
          const simplePattern = pattern.replace(/\*\*/g, "").replace(/\*/g, "");
          return relativePath.includes(simplePattern);
        });
        if (isExcluded) continue;

        // コンポーネントファイルには @usedComponents のみ修正
        const fixResult = applyFixes(content, relativePath, {
          fixUsedComponents: !!config.rules["usedComponents-match"],
          fixScreen: false,
          fixRoute: false,
        });

        if (fixResult.changed) {
          writeFile(file, fixResult.content);
          results.push({
            file: relativePath,
            fixed: true,
            changes: fixResult.changes,
          });
        }
      }
    }
  }

  return results;
}

/**
 * lint-annotations を実行
 */
function runLintAnnotations(
  projectPath: string,
  config: LintAnnotationsConfig,
  logger: ReturnType<typeof createLogger>
): LintAnnotationsReport {
  const fileResults: FileAnnotationReport[] = [];

  // Screen files (page.tsx)
  const screenRule = config.rules["screen-required"];
  if (screenRule) {
    const screenPaths = screenRule.paths || ["apps/*/app/**/page.tsx"];
    for (const pattern of screenPaths) {
      const fullPattern = resolvePath(projectPath, pattern);
      const files = globSync(fullPattern, { nodir: true });

      logger.info(`Screen files: ${files.length} files matching ${pattern}`);

      for (const file of files) {
        const relativePath = relative(projectPath, file);
        const content = readFile(file);
        if (!content) continue;

        const result = validateScreenFile(
          content,
          relativePath,
          config,
          screenRule.exclude || []
        );
        fileResults.push(result);
      }
    }
  }

  // Component files
  const componentRule = config.rules["component-required"];
  if (componentRule) {
    const componentPaths =
      componentRule.paths || ["apps/*/components/**/*.tsx"];
    for (const pattern of componentPaths) {
      const fullPattern = resolvePath(projectPath, pattern);
      const files = globSync(fullPattern, { nodir: true });

      logger.info(
        `Component files: ${files.length} files matching ${pattern}`
      );

      for (const file of files) {
        const relativePath = relative(projectPath, file);
        const content = readFile(file);
        if (!content) continue;

        const result = validateComponentFile(
          content,
          relativePath,
          config,
          componentRule.exclude || []
        );
        fileResults.push(result);
      }
    }
  }

  // Calculate summary
  let usedComponentsMismatch = 0;
  let missingScreen = 0;
  let missingComponent = 0;
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  let filesWithIssues = 0;

  for (const fr of fileResults) {
    if (!fr.result.valid) {
      filesWithIssues++;
    }
    errorCount += fr.result.errors.length;
    warningCount += fr.result.warnings.length;
    infoCount += fr.result.infos.length;

    if (fr.usedComponents && !fr.usedComponents.valid) {
      usedComponentsMismatch++;
    }
    if (
      fr.screenCheck &&
      !fr.screenCheck.valid &&
      !fr.screenCheck.skipped
    ) {
      missingScreen++;
    }
    if (
      fr.componentCheck &&
      !fr.componentCheck.valid &&
      !fr.componentCheck.skipped
    ) {
      missingComponent++;
    }
  }

  return {
    fileResults,
    summary: {
      filesChecked: fileResults.length,
      filesWithIssues,
      usedComponentsMismatch,
      missingScreen,
      missingComponent,
      errorCount,
      warningCount,
      infoCount,
    },
    passed: errorCount === 0 && warningCount === 0,
  };
}

/**
 * Screen ファイルを検証
 */
function validateScreenFile(
  content: string,
  filePath: string,
  config: LintAnnotationsConfig,
  exclude: string[]
): FileAnnotationReport {
  const allIssues: AnnotationIssue[] = [];

  // Check @screen annotation
  const screenCheck = checkScreenAnnotation(content, filePath, { exclude });
  allIssues.push(...screenCheck.errors, ...screenCheck.warnings, ...screenCheck.infos);

  // Check @usedComponents
  const usedComponentsRule = config.rules["usedComponents-match"];
  let usedComponentsResult = undefined;
  if (usedComponentsRule) {
    const annotated = extractUsedComponentsAnnotation(content);
    const imported = extractComponentsFromImports(content, {
      excludeHooks: usedComponentsRule.excludeHooks ?? true,
    });
    const comparison = compareUsedComponents(annotated, imported);
    usedComponentsResult = comparison;

    if (!comparison.valid) {
      if (comparison.missing.length > 0) {
        allIssues.push({
          type: usedComponentsRule.severity || "warning",
          message: `@usedComponents missing: ${comparison.missing.join(", ")}`,
          file: filePath,
          rule: "usedComponents-match",
          annotation: "@usedComponents",
          missing: comparison.missing,
        });
      }
      if (comparison.extra.length > 0) {
        allIssues.push({
          type: usedComponentsRule.severity || "warning",
          message: `@usedComponents extra: ${comparison.extra.join(", ")}`,
          file: filePath,
          rule: "usedComponents-match",
          annotation: "@usedComponents",
          extra: comparison.extra,
        });
      }
    }
  }

  const errors = allIssues.filter((e) => e.type === "error");
  const warnings = allIssues.filter((e) => e.type === "warning");
  const infos = allIssues.filter((e) => e.type === "info");

  return {
    file: filePath,
    fileType: "screen",
    usedComponents: usedComponentsResult,
    screenCheck,
    result: {
      valid: errors.length === 0 && warnings.length === 0,
      errors,
      warnings,
      infos,
    },
  };
}

/**
 * Component ファイルを検証
 */
function validateComponentFile(
  content: string,
  filePath: string,
  config: LintAnnotationsConfig,
  exclude: string[]
): FileAnnotationReport {
  const allIssues: AnnotationIssue[] = [];

  // Check @component annotation
  const componentCheck = checkComponentAnnotation(content, filePath, {
    exclude,
  });
  allIssues.push(...componentCheck.errors, ...componentCheck.warnings, ...componentCheck.infos);

  // Check @usedComponents (components can also use other components)
  const usedComponentsRule = config.rules["usedComponents-match"];
  let usedComponentsResult = undefined;
  if (usedComponentsRule && !componentCheck.skipped) {
    const annotated = extractUsedComponentsAnnotation(content);
    // Only check if there is an annotation
    if (annotated.length > 0) {
      const imported = extractComponentsFromImports(content, {
        excludeHooks: usedComponentsRule.excludeHooks ?? true,
      });
      const comparison = compareUsedComponents(annotated, imported);
      usedComponentsResult = comparison;

      if (!comparison.valid) {
        if (comparison.missing.length > 0) {
          allIssues.push({
            type: usedComponentsRule.severity || "warning",
            message: `@usedComponents missing: ${comparison.missing.join(", ")}`,
            file: filePath,
            rule: "usedComponents-match",
            annotation: "@usedComponents",
            missing: comparison.missing,
          });
        }
        if (comparison.extra.length > 0) {
          allIssues.push({
            type: usedComponentsRule.severity || "warning",
            message: `@usedComponents extra: ${comparison.extra.join(", ")}`,
            file: filePath,
            rule: "usedComponents-match",
            annotation: "@usedComponents",
            extra: comparison.extra,
          });
        }
      }
    }
  }

  const errors = allIssues.filter((e) => e.type === "error");
  const warnings = allIssues.filter((e) => e.type === "warning");
  const infos = allIssues.filter((e) => e.type === "info");

  return {
    file: filePath,
    fileType: "component",
    usedComponents: usedComponentsResult,
    componentCheck,
    result: {
      // valid means no errors or warnings (infos are ok)
      valid: errors.length === 0 && warnings.length === 0,
      errors,
      warnings,
      infos,
    },
  };
}

/**
 * レポートをフォーマット
 */
function formatReport(
  report: LintAnnotationsReport,
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
function formatSummary(report: LintAnnotationsReport): string {
  const { summary } = report;
  const lines: string[] = [
    "",
    `Annotation Consistency Check Summary`,
    `====================================`,
    "",
    `Files Checked:        ${summary.filesChecked}`,
    `Files with Issues:    ${summary.filesWithIssues}`,
    ``,
    `Issues by Type:`,
    `  @usedComponents:    ${summary.usedComponentsMismatch}`,
    `  Missing @screen:    ${summary.missingScreen}`,
    `  Missing @component: ${summary.missingComponent}`,
    ``,
    `Severity:`,
    `  Errors:             ${summary.errorCount}`,
    `  Warnings:           ${summary.warningCount}`,
    `  Info:               ${summary.infoCount}`,
    "",
    report.passed ? "PASSED" : "FAILED",
    "",
  ];

  return lines.join("\n");
}

/**
 * ターミナルフォーマット
 */
function formatTerminal(report: LintAnnotationsReport): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("Annotation Consistency Check");
  lines.push("=".repeat(60));
  lines.push("");

  // Group by file type
  const screens = report.fileResults.filter((f) => f.fileType === "screen");
  const components = report.fileResults.filter(
    (f) => f.fileType === "component"
  );

  // Screen files with issues
  const screensWithIssues = screens.filter((f) => !f.result.valid);
  if (screensWithIssues.length > 0) {
    lines.push("Screen Files:");
    lines.push("-".repeat(40));
    for (const fr of screensWithIssues) {
      lines.push(`  ${fr.file}`);
      for (const err of [
        ...fr.result.errors,
        ...fr.result.warnings,
        ...fr.result.infos,
      ]) {
        const icon =
          err.type === "error"
            ? "\u274C"
            : err.type === "warning"
              ? "\u26A0\uFE0F"
              : "\u2139\uFE0F";
        lines.push(`    ${icon} ${err.message}`);
      }
    }
    lines.push("");
  }

  // Component files with issues
  const componentsWithIssues = components.filter((f) => !f.result.valid);
  if (componentsWithIssues.length > 0) {
    lines.push("Component Files:");
    lines.push("-".repeat(40));
    for (const fr of componentsWithIssues) {
      lines.push(`  ${fr.file}`);
      for (const err of [
        ...fr.result.errors,
        ...fr.result.warnings,
        ...fr.result.infos,
      ]) {
        const icon =
          err.type === "error"
            ? "\u274C"
            : err.type === "warning"
              ? "\u26A0\uFE0F"
              : "\u2139\uFE0F";
        lines.push(`    ${icon} ${err.message}`);
      }
    }
    lines.push("");
  }

  // Summary
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("Summary:");
  lines.push(`  Files Checked:        ${report.summary.filesChecked}`);
  lines.push(`  Files with Issues:    ${report.summary.filesWithIssues}`);
  lines.push(`  @usedComponents:      ${report.summary.usedComponentsMismatch}`);
  lines.push(`  Missing @screen:      ${report.summary.missingScreen}`);
  lines.push(`  Missing @component:   ${report.summary.missingComponent}`);
  lines.push("");
  lines.push(`  \u274C Errors:           ${report.summary.errorCount}`);
  lines.push(`  \u26A0\uFE0F  Warnings:        ${report.summary.warningCount}`);
  lines.push(`  \u2139\uFE0F  Info:            ${report.summary.infoCount}`);
  lines.push("");
  lines.push(report.passed ? "\u2705 PASSED" : "\u274C FAILED");
  lines.push("");

  return lines.join("\n");
}
