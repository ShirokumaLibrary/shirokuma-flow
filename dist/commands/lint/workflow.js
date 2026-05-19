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
import { resolve } from "node:path";
import { loadConfig } from "../../utils/config.js";
import { writeFile } from "../../utils/file.js";
import { determineLintExitCode } from "../../lint/exit-code.js";
import { createLogger } from "../../utils/logger.js";
import { checkIssueFields } from "../../lint/rules/workflow-issue-fields.js";
import { checkBranchNaming } from "../../lint/rules/workflow-branch-naming.js";
import { checkMainProtection } from "../../lint/rules/workflow-main-protection.js";
import { checkCommitFormat } from "../../lint/rules/workflow-commit-format.js";
import { checkCoAuthoredBy } from "../../lint/rules/workflow-co-authored-by.js";
/**
 * Default lint-workflow configuration
 */
const defaultLintWorkflowConfig = {
    enabled: true,
    strict: false,
    rules: {
        "issue-fields": { severity: "warning", enabled: true },
        "branch-naming": { severity: "warning", enabled: true },
        "main-protection": { severity: "error", enabled: true },
        "commit-format": { severity: "warning", enabled: true },
        "co-authored-by": { severity: "warning", enabled: true },
    },
};
/**
 * lint-workflow command handler
 */
export async function lintWorkflowCommand(options) {
    const logger = createLogger(options.verbose);
    const projectPath = resolve(options.project);
    logger.info("Validating workflow conventions");
    // Load config
    const config = loadConfig(projectPath, options.config);
    const lintWorkflowConfig = {
        ...defaultLintWorkflowConfig,
        ...config.lintWorkflow,
        rules: {
            ...defaultLintWorkflowConfig.rules,
            ...config.lintWorkflow?.rules,
        },
    };
    const strict = options.strict ?? lintWorkflowConfig.strict ?? false;
    // Determine which rules to run
    const hasFilter = options.issues || options.branches || options.commits;
    const runIssues = (!hasFilter || options.issues) &&
        lintWorkflowConfig.rules?.["issue-fields"]?.enabled !== false;
    const runBranches = (!hasFilter || options.branches) &&
        lintWorkflowConfig.rules?.["branch-naming"]?.enabled !== false;
    const runCommits = (!hasFilter || options.commits) &&
        lintWorkflowConfig.rules?.["main-protection"]?.enabled !== false;
    // Run checks
    const ruleResults = [];
    if (runIssues) {
        logger.debug("Checking issue field completeness...");
        const issueFieldsSeverity = lintWorkflowConfig.rules?.["issue-fields"]?.severity ?? "warning";
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
        const branchSeverity = lintWorkflowConfig.rules?.["branch-naming"]?.severity ?? "warning";
        const prefixes = lintWorkflowConfig.rules?.["branch-naming"]?.prefixes ?? undefined;
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
        const mainProtSeverity = lintWorkflowConfig.rules?.["main-protection"]?.severity ?? "error";
        const protectedBranches = lintWorkflowConfig.rules?.["main-protection"]?.branches ?? undefined;
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
            const commitSeverity = lintWorkflowConfig.rules?.["commit-format"]?.severity ?? "warning";
            const commitTypes = lintWorkflowConfig.rules?.["commit-format"]?.types ?? undefined;
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
            const coAuthoredBySeverity = lintWorkflowConfig.rules?.["co-authored-by"]?.severity ?? "warning";
            const coAuthoredByIssues = await checkCoAuthoredBy(coAuthoredBySeverity);
            ruleResults.push({
                rule: "co-authored-by",
                description: "Co-Authored-By signature detection in commits",
                issues: coAuthoredByIssues,
                passed: coAuthoredByIssues.filter((i) => i.type === "error").length === 0,
            });
        }
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
    }
    else {
        console.log(output);
    }
    // Exit code
    if (report.passed) {
        logger.success(`Workflow validation passed (${report.summary.warningCount} warning(s))`);
    }
    else if (strict) {
        logger.error(`Workflow validation failed - ${report.summary.errorCount} error(s)`);
    }
    else {
        logger.warn(`Workflow validation completed - ${report.summary.errorCount} error(s) (non-strict mode)`);
    }
    return determineLintExitCode(report.passed, strict);
}
/**
 * Build a report from rule results
 */
function buildReport(ruleResults) {
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
function formatReport(report, format) {
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
function formatSummary(report) {
    const { summary } = report;
    const lines = [
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
function formatTerminal(report) {
    const lines = [];
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
function getIssueIcon(type) {
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
//# sourceMappingURL=workflow.js.map