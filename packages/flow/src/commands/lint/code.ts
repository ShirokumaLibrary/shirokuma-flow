/**
 * lint-code コマンド - TypeScript コード構造検証
 *
 * Server Actions モジュールの JSDoc タグ・構造を機械的にチェック
 *
 * 検証ルール:
 * - server-action-structure: 認証 -> CSRF -> Zod の順序検証
 * - annotation-required: 必須アノテーション検出
 */

import { resolve, relative, basename } from "node:path";
import { globSync } from "glob";
import { loadConfig, resolvePath } from "../../utils/config.js";
import { readFile, writeFile } from "../../utils/file.js";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
import { determineLintExitCode } from "@shirokuma-library/lint/errors";
import type {
  LintCodeConfig,
  ServerActionsLintConfig,
  LintCodeReport,
  FileCodeValidationReport,
  FunctionValidationResult,
  CodeIssue,
} from "../../lint/code-types.js";
import { serverActionStructureRule } from "../../lint/rules/server-action-structure.js";
import { annotationRequiredRule } from "../../lint/rules/annotation-required.js";

/**
 * コマンドオプション
 */
interface LintCodeOptions {
  project: string;
  config: string;
  format?: "terminal" | "json" | "summary";
  output?: string;
  strict?: boolean;
  verbose?: boolean;
}

/**
 * デフォルト設定
 */
const defaultServerActionsConfig: ServerActionsLintConfig = {
  filePattern: "apps/*/lib/actions/*.ts",
  excludePattern: "*-types.ts",
  requiredFileHeader: ["@serverAction", "@feature", "@dbTables"],
  requiredFunctionTags: ["@serverAction", "@feature", "@returns"],
  sectionSeparators: false,
};

/**
 * lint-code コマンドハンドラ
 */
export function lintCodeCommand(options: LintCodeOptions): number {
  const logger = createLogger(options.verbose, options.format === "json");
  const projectPath = resolve(options.project);

  logger.info(t("commands.lintCode.validating"));

  // 設定読み込み
  const config = loadConfig(projectPath, options.config);
  const lintCodeConfig = config.lintCode as LintCodeConfig | undefined;

  if (!lintCodeConfig?.enabled) {
    // enabled: false が明示的に設定されている場合はサイレントスキップ
    if (!lintCodeConfig || lintCodeConfig.enabled === undefined) {
      logger.warn("lint-code is not enabled in config. Add 'lintCode: { enabled: true }' to .shirokuma/config.yaml");
    }
    return 0;
  }

  const strict = options.strict ?? lintCodeConfig.strict ?? false;

  // 検証実行
  const report = runLintCode(projectPath, lintCodeConfig, logger);

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
    logger.success(t("commands.lintCode.allPassed"));
  } else if (strict) {
    logger.error(`コード検証失敗 - ${report.summary.errorCount}件のエラー`);
  } else {
    logger.warn(
      `コード検証完了 - ${report.summary.errorCount}件のエラー（non-strictモード）`
    );
  }
  return determineLintExitCode(report.passed, strict);
}

/**
 * lint-code を実行
 */
function runLintCode(
  projectPath: string,
  config: LintCodeConfig,
  logger: ReturnType<typeof createLogger>
): LintCodeReport {
  const fileResults: FileCodeValidationReport[] = [];

  // Server Actions 検証
  if (config.serverActions) {
    const saConfig = {
      ...defaultServerActionsConfig,
      ...config.serverActions,
    };
    const saResults = validateServerActions(projectPath, saConfig, logger);
    fileResults.push(...saResults);
  }

  // サマリー計算
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfos = 0;
  let totalFunctions = 0;

  for (const fr of fileResults) {
    totalErrors += fr.result.errors.length;
    totalWarnings += fr.result.warnings.length;
    totalInfos += fr.result.infos.length;
    totalFunctions += fr.functions.length;
  }

  return {
    fileResults,
    summary: {
      totalFiles: fileResults.length,
      validatedFiles: fileResults.length,
      totalFunctions,
      errorCount: totalErrors,
      warningCount: totalWarnings,
      infoCount: totalInfos,
    },
    passed: totalErrors === 0,
  };
}

/**
 * Server Actions を検証
 */
function validateServerActions(
  projectPath: string,
  config: ServerActionsLintConfig,
  logger: ReturnType<typeof createLogger>
): FileCodeValidationReport[] {
  const results: FileCodeValidationReport[] = [];

  // ファイル収集
  const fullPattern = resolvePath(projectPath, config.filePattern);
  let matchedFiles = globSync(fullPattern, { nodir: true });

  // 除外パターン適用
  if (config.excludePattern) {
    const excludePattern = config.excludePattern;
    matchedFiles = matchedFiles.filter((file) => {
      const fileName = basename(file);
      // 簡易的なパターンマッチング (*-types.ts)
      if (excludePattern.startsWith("*")) {
        const suffix = excludePattern.slice(1);
        return !fileName.endsWith(suffix);
      }
      return fileName !== excludePattern;
    });
  }

  // 除外ファイルリスト適用
  if (config.excludeFiles && config.excludeFiles.length > 0) {
    const excludeSet = new Set(config.excludeFiles);
    matchedFiles = matchedFiles.filter((file) => {
      const fileName = basename(file);
      return !excludeSet.has(fileName);
    });
  }

  logger.info(`検証対象ファイル: ${matchedFiles.length}件`);

  for (const filePath of matchedFiles) {
    const relativePath = relative(projectPath, filePath);
    logger.debug(`検証中: ${relativePath}`);

    const content = readFile(filePath);
    if (!content) {
      results.push({
        file: relativePath,
        description: "Server Action",
        moduleHeader: { exists: false, tags: [], missingTags: [] },
        functions: [],
        result: {
          valid: false,
          errors: [
            {
              type: "error",
              message: "Failed to read file",
              file: relativePath,
              rule: "file-read",
            },
          ],
          warnings: [],
          infos: [],
        },
      });
      continue;
    }

    const report = validateServerActionFile(content, relativePath, config);
    results.push(report);
  }

  return results;
}

/**
 * Server Action ファイルを検証
 */
function validateServerActionFile(
  content: string,
  filePath: string,
  config: ServerActionsLintConfig
): FileCodeValidationReport {
  const issues: CodeIssue[] = [];

  // モジュールヘッダー検証
  const moduleHeader = validateModuleHeader(
    content,
    filePath,
    config.requiredFileHeader
  );
  issues.push(...moduleHeader.issues);

  // 関数検証
  const functions = validateFunctions(
    content,
    filePath,
    config.requiredFunctionTags
  );
  for (const fn of functions) {
    issues.push(...fn.issues);
  }

  // セクション区切り検証
  if (config.sectionSeparators) {
    const sectionIssues = validateSectionSeparators(content, filePath);
    issues.push(...sectionIssues);
  }

  // 新しいルール: Server Action 構造検証
  for (const fn of functions) {
    const structureIssues = serverActionStructureRule.check(
      content,
      filePath,
      fn.name,
      fn.line
    );
    issues.push(...structureIssues);
    fn.issues.push(...structureIssues);
  }

  // 新しいルール: 必須アノテーション検証
  const annotationIssues = annotationRequiredRule.check(content, filePath);
  issues.push(...annotationIssues);

  // 結果を分類
  const errors = issues.filter((i) => i.type === "error");
  const warnings = issues.filter((i) => i.type === "warning");
  const infos = issues.filter((i) => i.type === "info");

  return {
    file: filePath,
    description: "Server Action",
    moduleHeader: {
      exists: moduleHeader.exists,
      tags: moduleHeader.tags,
      missingTags: moduleHeader.missingTags,
    },
    functions,
    result: {
      valid: errors.length === 0,
      errors,
      warnings,
      infos,
    },
  };
}

/**
 * モジュールヘッダーを検証
 */
function validateModuleHeader(
  content: string,
  filePath: string,
  requiredTags: string[]
): {
  exists: boolean;
  tags: string[];
  missingTags: string[];
  issues: CodeIssue[];
} {
  const issues: CodeIssue[] = [];

  // "use server" の後の最初のJSDocブロックを探す
  const useServerMatch = content.match(/^["']use server["']\s*/);
  if (!useServerMatch) {
    // "use server" がない場合はスキップ
    return { exists: false, tags: [], missingTags: [], issues: [] };
  }

  // ファイル先頭付近（最初の import/export の前）のJSDocを探す
  const headerAreaMatch = content.match(
    /^["']use server["']\s*(\/\*\*[\s\S]*?\*\/)/
  );

  if (!headerAreaMatch) {
    issues.push({
      type: "error",
      message: "モジュールヘッダー JSDoc がありません",
      file: filePath,
      rule: "module-header-required",
    });
    return { exists: false, tags: [], missingTags: requiredTags, issues };
  }

  const headerJSDoc = headerAreaMatch[1];
  const detectedTags = extractTags(headerJSDoc);
  const missingTags = requiredTags.filter((tag) => !detectedTags.includes(tag));

  for (const tag of missingTags) {
    issues.push({
      type: "error",
      message: `モジュールヘッダーに ${tag} タグがありません`,
      file: filePath,
      rule: "module-header-tag",
    });
  }

  return {
    exists: true,
    tags: detectedTags,
    missingTags,
    issues,
  };
}

/**
 * 関数を検証
 */
function validateFunctions(
  content: string,
  filePath: string,
  requiredTags: string[]
): FunctionValidationResult[] {
  const results: FunctionValidationResult[] = [];

  // export async function または export function を検出
  const functionRegex =
    /(?:(\/\*\*[\s\S]*?\*\/)\s*)?export\s+(?:async\s+)?function\s+(\w+)\s*\(/g;

  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    const jsdocBlock = match[1] || "";
    const functionName = match[2];
    const lineNumber = getLineNumber(content, match.index);

    const issues: CodeIssue[] = [];
    const hasJSDoc = jsdocBlock.length > 0;

    if (!hasJSDoc) {
      issues.push({
        type: "error",
        message: `関数 ${functionName} に JSDoc がありません`,
        file: filePath,
        line: lineNumber,
        rule: "function-jsdoc-required",
        functionName,
      });
      results.push({
        name: functionName,
        line: lineNumber,
        hasJSDoc: false,
        tags: [],
        missingTags: requiredTags,
        issues,
      });
      continue;
    }

    const detectedTags = extractTags(jsdocBlock);
    const missingTags = requiredTags.filter((tag) => !detectedTags.includes(tag));

    for (const tag of missingTags) {
      issues.push({
        type: "error",
        message: `関数 ${functionName} に ${tag} タグがありません`,
        file: filePath,
        line: lineNumber,
        rule: "function-tag-required",
        functionName,
      });
    }

    results.push({
      name: functionName,
      line: lineNumber,
      hasJSDoc: true,
      tags: detectedTags,
      missingTags,
      issues,
    });
  }

  return results;
}

/**
 * セクション区切りを検証
 */
function validateSectionSeparators(
  content: string,
  filePath: string
): CodeIssue[] {
  const issues: CodeIssue[] = [];

  // セクション区切りパターン
  const sectionPattern = /\/\/\s*={10,}/g;
  const matches = content.match(sectionPattern);

  if (!matches || matches.length < 2) {
    issues.push({
      type: "warning",
      message: "セクション区切りコメントが不足しています（最低2つ推奨）",
      file: filePath,
      rule: "section-separators",
    });
  }

  return issues;
}

/**
 * JSDoc からタグを抽出
 */
function extractTags(jsdocBlock: string): string[] {
  const tags: string[] = [];
  const tagRegex = /@(\w+)/g;
  let match;

  while ((match = tagRegex.exec(jsdocBlock)) !== null) {
    tags.push(`@${match[1]}`);
  }

  return [...new Set(tags)];
}

/**
 * 行番号を取得
 */
function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

/**
 * レポートをフォーマット
 */
function formatReport(
  report: LintCodeReport,
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
function formatSummary(report: LintCodeReport): string {
  const { summary } = report;
  const lines: string[] = [
    "",
    `Code Validation Summary`,
    `=======================`,
    "",
    `Files Validated:  ${summary.validatedFiles}`,
    `Functions:        ${summary.totalFunctions}`,
    `Errors:           ${summary.errorCount}`,
    `Warnings:         ${summary.warningCount}`,
    `Info:             ${summary.infoCount}`,
    "",
    report.passed ? "PASSED" : "FAILED",
    "",
  ];

  return lines.join("\n");
}

/**
 * ターミナルフォーマット
 */
function formatTerminal(report: LintCodeReport): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("Code Structure Validation (Server Actions)");
  lines.push("=".repeat(60));
  lines.push("");

  for (const fr of report.fileResults) {
    const icon = fr.result.valid ? "\u2705" : "\u274C";
    lines.push(`${icon} ${fr.file}`);

    // モジュールヘッダー情報
    if (!fr.moduleHeader.exists) {
      lines.push(`   \u274C Module header missing`);
    } else if (fr.moduleHeader.missingTags.length > 0) {
      lines.push(
        `   \u26A0\uFE0F  Missing header tags: ${fr.moduleHeader.missingTags.join(", ")}`
      );
    }

    // 関数情報
    for (const fn of fr.functions) {
      if (fn.issues.length > 0) {
        lines.push(`   \u274C ${fn.name}() [line ${fn.line}]`);
        for (const issue of fn.issues) {
          const issueIcon = issue.type === "error" ? "\u274C" : "\u26A0\uFE0F";
          lines.push(`      ${issueIcon} ${issue.message}`);
        }
      }
    }

    lines.push("");
  }

  // サマリー
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("Summary:");
  lines.push(`  Files Validated:  ${report.summary.validatedFiles}`);
  lines.push(`  Functions:        ${report.summary.totalFunctions}`);
  lines.push(`  \u274C Errors:         ${report.summary.errorCount}`);
  lines.push(`  \u26A0\uFE0F  Warnings:       ${report.summary.warningCount}`);
  lines.push(`  \u2139\uFE0F  Info:           ${report.summary.infoCount}`);
  lines.push("");
  lines.push(report.passed ? "\u2705 PASSED" : "\u274C FAILED");
  lines.push("");

  return lines.join("\n");
}
