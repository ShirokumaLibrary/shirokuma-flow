/**
 * workflow-branch-naming rule
 *
 * Validates the current git branch name against the convention:
 *   {type}/{issue-number}-{slug}
 *
 * Valid types: feat, fix, chore, docs, hotfix, epic, release
 * Persistent branches (main, develop) are always valid.
 */
import { getCurrentBranch } from "../../utils/git-local.js";
const DEFAULT_PREFIXES = ["feat", "fix", "chore", "docs", "hotfix", "epic"];
const PERSISTENT_BRANCHES = ["main", "develop", "master"];
/**
 * Branch naming convention: {type}/{number}-{slug} or release/X.x
 */
const BRANCH_PATTERN = /^([a-z]+)\/(\d+)-([a-z0-9-]+)$/;
const RELEASE_PATTERN = /^release\/\d+\.x$/;
/**
 * Pure validation: validate a branch name against naming convention.
 * Exported for testing.
 */
export function validateBranchName(branchName, severity = "warning", allowedPrefixes = DEFAULT_PREFIXES) {
    const issues = [];
    // Persistent branches are always valid
    if (PERSISTENT_BRANCHES.includes(branchName)) {
        return issues;
    }
    // Release branches have a different pattern
    if (RELEASE_PATTERN.test(branchName)) {
        return issues;
    }
    // Check naming convention
    const match = BRANCH_PATTERN.exec(branchName);
    if (!match) {
        issues.push({
            type: severity,
            message: `Branch "${branchName}" does not match convention: {type}/{number}-{slug}`,
            rule: "branch-naming",
            context: branchName,
        });
        return issues;
    }
    const [, prefix, , slug] = match;
    // Check prefix is allowed
    if (!allowedPrefixes.includes(prefix)) {
        issues.push({
            type: severity,
            message: `Branch prefix "${prefix}" is not in allowed list: ${allowedPrefixes.join(", ")}`,
            rule: "branch-naming",
            context: branchName,
        });
    }
    // Check slug length (max 40 characters)
    if (slug.length > 40) {
        issues.push({
            type: "info",
            message: `Branch slug "${slug}" exceeds 40 characters (${slug.length})`,
            rule: "branch-naming",
            context: branchName,
        });
    }
    return issues;
}
/**
 * Get current branch and check naming convention.
 */
export function checkBranchNaming(severity = "warning", allowedPrefixes = DEFAULT_PREFIXES) {
    // Get current branch name
    const branchName = getCurrentBranch();
    if (!branchName) {
        return [
            {
                type: "info",
                message: "Could not determine current branch. Skipping branch-naming check.",
                rule: "branch-naming",
            },
        ];
    }
    return validateBranchName(branchName, severity, allowedPrefixes);
}
//# sourceMappingURL=workflow-branch-naming.js.map