/**
 * lint-workflow command - AI workflow validation
 *
 * Validates that AI workflow conventions are followed:
 * - Issue field completeness (Priority, Size)
 * - Branch naming convention ({type}/{number}-{slug})
 * - Protected branch protection (no direct commits on main/develop)
 * - Co-Authored-By signature detection
 *
 * Rules:
 * - issue-fields: Check open issues for missing project fields (P1)
 * - branch-naming: Validate current branch name convention (P1)
 * - main-protection: Detect direct commits on protected branches (P1)
 * - commit-format: Validate Conventional Commits format (P2)
 * - co-authored-by: Detect Co-Authored-By signatures in commits (P2)
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig } from "../../utils/config.js";
import { writeFile } from "../../utils/file.js";
import { determineLintExitCode } from "@shirokuma-library/lint/errors";
import { createLogger } from "../../utils/logger.js";
import type {
  LintWorkflowConfig,
  LintWorkflowReport,
  WorkflowIssue,
  WorkflowRuleResult,
} from "../../lint/workflow-types.js";
import { checkIssueFields } from "../../lint/rules/workflow-issue-fields.js";
import { checkBranchNaming } from "../../lint/rules/workflow-branch-naming.js";
import { checkMainProtection } from "../../lint/rules/workflow-main-protection.js";
import { checkCommitFormat } from "../../lint/rules/workflow-commit-format.js";
import { checkCoAuthoredBy } from "../../lint/rules/workflow-co-authored-by.js";
import {
  DEFAULT_BUDGET_LINES,
  DEFAULT_INDEX_DIR,
  validateClaudeMdBudget,
  validateClaudeMdIndexDrift,
} from "../../lint/rules/workflow-claude-md.js";
import {
  DEFAULT_WARN_LINES,
  DEFAULT_ERROR_LINES,
  DEFAULT_PLUGIN_DIRS,
  checkSkillMdSize,
} from "../../lint/rules/workflow-skill-md-size.js";
import { checkCommentFirst } from "../../lint/rules/workflow-github-item-comment-first.js";
import { checkBodyHistory } from "../../lint/rules/workflow-github-item-body-history.js";

/**
 * Command options
 */
interface LintWorkflowOptions {
  project: string;
  config: string;
  format?: "terminal" | "json" | "summary";
  output?: string;
  strict?: boolean;
  verbose?: boolean;
  // Filter flags
  issues?: boolean;
  branches?: boolean;
  commits?: boolean;
  /** GitHub アイテム（Issue/PR/Discussion）の本文/コメント原則を検査（#2821） */
  githubItems?: boolean;
  /** 検査対象アイテム番号（--github-items 用。value-taking option） */
  item?: number;
}

/**
 * Default lint-workflow configuration
 */
const defaultLintWorkflowConfig: LintWorkflowConfig = {
  enabled: true,
  strict: false,
  rules: {
    "issue-fields": { severity: "warning", enabled: true },
    "branch-naming": { severity: "warning", enabled: true },
    "main-protection": { severity: "error", enabled: true },
    "commit-format": { severity: "warning", enabled: true },
    "co-authored-by": { severity: "warning", enabled: true },
    "github-item-comment-first": { severity: "warning", enabled: true },
    "github-item-body-history": { severity: "warning", enabled: true },
    "claude-md-budget": { severity: "warning", enabled: true, maxLines: 150 },
    "claude-md-index-drift": { severity: "warning", enabled: true },
    "skill-md-size": {
      enabled: true,
      warnLines: DEFAULT_WARN_LINES,
      errorLines: DEFAULT_ERROR_LINES,
    },
  },
};

/**
 * lint-workflow command handler
 */
export async function lintWorkflowCommand(
  options: LintWorkflowOptions
): Promise<number> {
  const logger = createLogger(options.verbose, options.format === "json");
  const projectPath = resolve(options.project);

  logger.info("Validating workflow conventions");

  // Load config
  const config = loadConfig(projectPath, options.config);
  const lintWorkflowConfig: LintWorkflowConfig = {
    ...defaultLintWorkflowConfig,
    ...config.lintWorkflow,
    rules: {
      ...defaultLintWorkflowConfig.rules,
      ...config.lintWorkflow?.rules,
    },
  };

  const strict = options.strict ?? lintWorkflowConfig.strict ?? false;

  // Determine which rules to run.
  // 設計判断 1 の CLI シグネチャ（素の `lint workflow`=既存+新規全込み /
  // `--github-items`=新規2ルールのみ）を満たすため、githubItems も hasFilter に含める。
  // - 素の `lint workflow`: hasFilter=false → 全ルール（既存5 + 新規2）が走る
  // - `--github-items --item N`: hasFilter=true → 既存ルールは走らず、
  //   runGithubItems=(!true||true)=true で新規2ルールのみが走る
  const hasFilter =
    options.issues || options.branches || options.commits || options.githubItems;
  const runIssues =
    (!hasFilter || options.issues) &&
    lintWorkflowConfig.rules?.["issue-fields"]?.enabled !== false;
  const runBranches =
    (!hasFilter || options.branches) &&
    lintWorkflowConfig.rules?.["branch-naming"]?.enabled !== false;
  const runCommits =
    (!hasFilter || options.commits) &&
    lintWorkflowConfig.rules?.["main-protection"]?.enabled !== false;

  // github-item-* ルール（#2821）。既存ルールと同じフィルタパターンに統一する。
  // さらに --item 未指定時は info でスキップする（後述）。
  const runGithubItems = !hasFilter || options.githubItems;

  // Run checks
  const ruleResults: WorkflowRuleResult[] = [];

  if (runIssues) {
    logger.debug("Checking issue field completeness...");
    const issueFieldsSeverity =
      lintWorkflowConfig.rules?.["issue-fields"]?.severity ?? "warning";
    const issues = await checkIssueFields(issueFieldsSeverity);
    ruleResults.push({
      rule: "issue-fields",
      description: "Issue field completeness (Priority, Size)",
      issues,
      passed: issues.filter((i) => i.type === "error").length === 0,
    });
  }

  if (runBranches) {
    logger.debug("Checking branch naming convention...");
    const branchSeverity =
      lintWorkflowConfig.rules?.["branch-naming"]?.severity ?? "warning";
    const prefixes =
      lintWorkflowConfig.rules?.["branch-naming"]?.prefixes ?? undefined;
    const issues = checkBranchNaming(branchSeverity, prefixes);
    ruleResults.push({
      rule: "branch-naming",
      description: "Branch naming convention ({type}/{number}-{slug})",
      issues,
      passed: issues.filter((i) => i.type === "error").length === 0,
    });
  }

  if (runCommits) {
    logger.debug("Checking protected branch protection...");
    const mainProtSeverity =
      lintWorkflowConfig.rules?.["main-protection"]?.severity ?? "error";
    const protectedBranches =
      lintWorkflowConfig.rules?.["main-protection"]?.branches ?? undefined;
    const issues = await checkMainProtection(mainProtSeverity, protectedBranches);
    ruleResults.push({
      rule: "main-protection",
      description: "Protected branch and commit conventions",
      issues,
      passed: issues.filter((i) => i.type === "error").length === 0,
    });

    // commit-format rule (also gated by --commits flag)
    if (lintWorkflowConfig.rules?.["commit-format"]?.enabled !== false) {
      logger.debug("Checking commit message format...");
      const commitSeverity =
        lintWorkflowConfig.rules?.["commit-format"]?.severity ?? "warning";
      const commitTypes =
        lintWorkflowConfig.rules?.["commit-format"]?.types ?? undefined;
      const commitIssues = await checkCommitFormat(commitSeverity, commitTypes);
      ruleResults.push({
        rule: "commit-format",
        description: "Conventional Commits format ({type}: {description})",
        issues: commitIssues,
        passed: commitIssues.filter((i) => i.type === "error").length === 0,
      });
    }

    // co-authored-by rule (also gated by --commits flag)
    if (lintWorkflowConfig.rules?.["co-authored-by"]?.enabled !== false) {
      logger.debug("Checking Co-Authored-By signatures...");
      const coAuthoredBySeverity =
        lintWorkflowConfig.rules?.["co-authored-by"]?.severity ?? "warning";
      const coAuthoredByIssues = await checkCoAuthoredBy(coAuthoredBySeverity);
      ruleResults.push({
        rule: "co-authored-by",
        description: "Co-Authored-By signature detection in commits",
        issues: coAuthoredByIssues,
        passed: coAuthoredByIssues.filter((i) => i.type === "error").length === 0,
      });
    }
  }

  // github-item-* rules（#2821）: 本文＝最新 payload / コメント＝Why 原則の検査。
  // --item 未指定時は info でスキップ（一括スキャンはスコープ外）。
  if (runGithubItems) {
    const commentFirstCfg = lintWorkflowConfig.rules?.["github-item-comment-first"];
    const bodyHistoryCfg = lintWorkflowConfig.rules?.["github-item-body-history"];
    const commentFirstEnabled = commentFirstCfg?.enabled !== false;
    const bodyHistoryEnabled = bodyHistoryCfg?.enabled !== false;

    if (options.item === undefined) {
      // --item 未指定: スキップ（info）。
      if (commentFirstEnabled) {
        ruleResults.push({
          rule: "github-item-comment-first",
          description: "本文＝最新 payload / コメント＝Why 原則（コメントファースト）",
          issues: [
            {
              type: "info",
              message:
                "--item <number> が未指定のため github-item-comment-first チェックをスキップします。",
              rule: "github-item-comment-first",
            },
          ],
          passed: true,
        });
      }
      if (bodyHistoryEnabled) {
        ruleResults.push({
          rule: "github-item-body-history",
          description: "本文＝最新 payload 原則（本文の履歴的記述検査・実験的）",
          issues: [
            {
              type: "info",
              message:
                "--item <number> が未指定のため github-item-body-history チェックをスキップします。",
              rule: "github-item-body-history",
            },
          ],
          passed: true,
        });
      }
    } else {
      const repoOpts = { public: false, repo: undefined };

      if (commentFirstEnabled) {
        logger.debug("Checking github-item comment-first principle...");
        const severity = commentFirstCfg?.severity ?? "warning";
        const issues = await checkCommentFirst(options.item, severity, repoOpts);
        ruleResults.push({
          rule: "github-item-comment-first",
          description: "本文＝最新 payload / コメント＝Why 原則（コメントファースト）",
          issues,
          passed: issues.filter((i) => i.type === "error").length === 0,
        });
      }

      if (bodyHistoryEnabled) {
        logger.debug("Checking github-item body-history principle...");
        const severity = bodyHistoryCfg?.severity ?? "warning";
        const issues = await checkBodyHistory(options.item, severity, repoOpts);
        ruleResults.push({
          rule: "github-item-body-history",
          description: "本文＝最新 payload 原則（本文の履歴的記述検査・実験的）",
          issues,
          passed: issues.filter((i) => i.type === "error").length === 0,
        });
      }
    }
  }

  // claude-md-* rules: read CLAUDE.md once, dispatch to both validators
  const budgetCfg = lintWorkflowConfig.rules?.["claude-md-budget"];
  const driftCfg = lintWorkflowConfig.rules?.["claude-md-index-drift"];
  const budgetEnabled = budgetCfg?.enabled !== false;
  const driftEnabled = driftCfg?.enabled !== false;

  if (budgetEnabled || driftEnabled) {
    const claudeMdAbsPath = join(projectPath, "CLAUDE.md");
    let claudeMdContent: string | null = null;
    let readError = false;
    if (existsSync(claudeMdAbsPath)) {
      try {
        claudeMdContent = readFileSync(claudeMdAbsPath, "utf-8");
      } catch {
        readError = true;
      }
    }

    const fallbackIssues = (rule: string): WorkflowIssue[] =>
      claudeMdContent === null
        ? [
            {
              type: readError ? "warning" : "info",
              message: readError
                ? `Failed to read CLAUDE.md for ${rule} check.`
                : `CLAUDE.md not found. Skipping ${rule} check.`,
              rule,
            },
          ]
        : [];

    if (budgetEnabled) {
      logger.debug("Checking CLAUDE.md line budget...");
      const issues =
        claudeMdContent === null
          ? fallbackIssues("claude-md-budget")
          : validateClaudeMdBudget(
              claudeMdContent,
              "CLAUDE.md",
              budgetCfg?.severity,
              budgetCfg?.maxLines ?? DEFAULT_BUDGET_LINES
            );
      ruleResults.push({
        rule: "claude-md-budget",
        description: "CLAUDE.md line budget (keeps context window efficient)",
        issues,
        passed: issues.filter((i) => i.type === "error").length === 0,
      });
    }

    if (driftEnabled) {
      logger.debug("Checking CLAUDE.md index drift...");
      const issues =
        claudeMdContent === null
          ? fallbackIssues("claude-md-index-drift")
          : validateClaudeMdIndexDrift(
              claudeMdContent,
              "CLAUDE.md",
              projectPath,
              driftCfg?.indexDir ?? DEFAULT_INDEX_DIR
            );
      ruleResults.push({
        rule: "claude-md-index-drift",
        description: "CLAUDE.md references to index files (drift detection)",
        issues,
        passed: issues.filter((i) => i.type === "error").length === 0,
      });
    }
  }

  // skill-md-size ルール: plugin/ 配下の SKILL.md 行数チェック
  const skillMdSizeCfg = lintWorkflowConfig.rules?.["skill-md-size"];
  const skillMdSizeEnabled = skillMdSizeCfg?.enabled !== false;

  if (skillMdSizeEnabled) {
    logger.debug("Checking SKILL.md line sizes...");
    const skillMdWarnLines = skillMdSizeCfg?.warnLines ?? DEFAULT_WARN_LINES;
    const skillMdErrorLines = skillMdSizeCfg?.errorLines ?? DEFAULT_ERROR_LINES;
    const skillMdPluginDirs = skillMdSizeCfg?.pluginDirs ?? DEFAULT_PLUGIN_DIRS;
    const skillMdIssues = checkSkillMdSize(
      projectPath,
      skillMdPluginDirs,
      skillMdWarnLines,
      skillMdErrorLines
    );
    ruleResults.push({
      rule: "skill-md-size",
      description: "SKILL.md line size check (keeps context window efficient)",
      issues: skillMdIssues,
      passed: skillMdIssues.filter((i) => i.type === "error").length === 0,
    });
  }

  // Build report
  const report = buildReport(ruleResults);

  // Format output
  const outputFormat = options.format || "terminal";
  const output = formatReport(report, outputFormat);

  // Write to file or stdout
  if (options.output) {
    writeFile(options.output, output);
    logger.success(`Report written to: ${options.output}`);
  } else {
    console.log(output);
  }

  // Exit code
  if (report.passed) {
    logger.success(
      `Workflow validation passed (${report.summary.warningCount} warning(s))`
    );
  } else if (strict) {
    logger.error(
      `Workflow validation failed - ${report.summary.errorCount} error(s)`
    );
  } else {
    logger.warn(
      `Workflow validation completed - ${report.summary.errorCount} error(s) (non-strict mode)`
    );
  }
  return determineLintExitCode(report.passed, strict);
}

/**
 * Build a report from rule results
 */
function buildReport(ruleResults: WorkflowRuleResult[]): LintWorkflowReport {
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const rr of ruleResults) {
    for (const issue of rr.issues) {
      switch (issue.type) {
        case "error":
          errorCount++;
          break;
        case "warning":
          warningCount++;
          break;
        case "info":
          infoCount++;
          break;
      }
    }
  }

  return {
    ruleResults,
    summary: {
      totalChecks: ruleResults.length,
      errorCount,
      warningCount,
      infoCount,
    },
    passed: errorCount === 0,
  };
}

/**
 * Format the report for output
 */
function formatReport(
  report: LintWorkflowReport,
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
 * Summary format
 */
function formatSummary(report: LintWorkflowReport): string {
  const { summary } = report;
  const lines: string[] = [
    "",
    "Workflow Validation Summary",
    "==========================",
    "",
    `Checks Run:  ${summary.totalChecks}`,
    `Errors:      ${summary.errorCount}`,
    `Warnings:    ${summary.warningCount}`,
    `Info:        ${summary.infoCount}`,
    "",
    report.passed ? "PASSED" : "FAILED",
    "",
  ];

  return lines.join("\n");
}

/**
 * Terminal format with colored output
 */
function formatTerminal(report: LintWorkflowReport): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("Workflow Convention Validation");
  lines.push("=".repeat(60));
  lines.push("");

  for (const rr of report.ruleResults) {
    const icon = rr.passed ? "\u2705" : "\u274C";
    lines.push(`${icon} ${rr.rule}: ${rr.description}`);

    if (rr.issues.length === 0) {
      lines.push("   No issues found");
    }

    for (const issue of rr.issues) {
      const issueIcon = getIssueIcon(issue.type);
      const ctx = issue.context ? ` [${issue.context}]` : "";
      lines.push(`   ${issueIcon} ${issue.message}${ctx}`);
    }

    lines.push("");
  }

  // Summary
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("Summary:");
  lines.push(`  Checks Run:     ${report.summary.totalChecks}`);
  lines.push(`  \u274C Errors:        ${report.summary.errorCount}`);
  lines.push(`  \u26A0\uFE0F  Warnings:      ${report.summary.warningCount}`);
  lines.push(`  \u2139\uFE0F  Info:          ${report.summary.infoCount}`);
  lines.push("");
  lines.push(report.passed ? "\u2705 PASSED" : "\u274C FAILED");
  lines.push("");

  return lines.join("\n");
}

function getIssueIcon(type: string): string {
  switch (type) {
    case "error":
      return "\u274C";
    case "warning":
      return "\u26A0\uFE0F";
    case "info":
      return "\u2139\uFE0F";
    default:
      return "\u2022";
  }
}
