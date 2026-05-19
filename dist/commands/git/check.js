/**
 * git check - Pre-push git state consolidation
 *
 * Consolidates git status, log, diff, and branch info into a single
 * JSON output for AI agent consumption, reducing context window usage.
 */
import { simpleGit } from "simple-git";
import { getPreflightGitState, generateGitWarnings, } from "../items/shared/session-utils.js";
// =============================================================================
// buildGitCheckOutput - Pure function (testable)
// =============================================================================
/**
 * Build GitCheckOutput from preflight git state and diff stat.
 * Pure function - no I/O, fully testable.
 *
 * Delegates warning generation to shared generateGitWarnings().
 */
export function buildGitCheckOutput(state, diffStat) {
    const warnings = generateGitWarnings(state);
    return {
        branch: state.branch,
        base_branch: state.baseBranch,
        is_feature_branch: state.isFeatureBranch,
        has_uncommitted_changes: state.hasUncommittedChanges,
        uncommitted_changes: state.uncommittedChanges,
        unpushed_commits: state.unpushedCommits,
        recent_commits: state.recentCommits,
        diff_stat: diffStat,
        warnings,
    };
}
// =============================================================================
// getDiffStat - I/O helper
// =============================================================================
/**
 * Get diff stat between base branch and HEAD.
 * Returns empty string if base branch is unknown or diff fails.
 */
async function getDiffStat(baseBranch, logger) {
    if (!baseBranch)
        return "";
    try {
        const git = simpleGit();
        const result = await git.raw(["diff", "--stat", `${baseBranch}..HEAD`]);
        return result?.trim() ?? "";
    }
    catch (e) {
        logger?.debug(`getDiffStat failed: ${String(e)}`);
        return "";
    }
}
// =============================================================================
// cmdGitCheck - Command handler
// =============================================================================
/**
 * git check: gather pre-push git state in a single command.
 * Returns JSON for programmatic consumption by commit-issue / open-pr-issue.
 */
export async function cmdGitCheck(options, logger) {
    // 1. Get extended git state (reuse items preflight logic)
    const state = await getPreflightGitState(logger);
    logger.debug(`Branch: ${state.branch ?? "(detached)"}`);
    logger.debug(`Base branch: ${state.baseBranch ?? "(unknown)"}`);
    // 2. Get diff stat against base branch
    const diffStat = await getDiffStat(state.baseBranch, logger);
    // 3. Build output
    const output = buildGitCheckOutput(state, diffStat);
    // 4. Print JSON
    console.log(JSON.stringify(output, null, 2));
    return 0;
}
//# sourceMappingURL=check.js.map