/**
 * git check - Pre-push git state consolidation
 *
 * Consolidates git status, log, diff, and branch info into a single
 * JSON output for AI agent consumption, reducing context window usage.
 */
import { Logger } from "../../utils/logger.js";
import { type PreflightGitState } from "../items/shared/session-utils.js";
export interface GitCheckOutput {
    branch: string | null;
    base_branch: string | null;
    is_feature_branch: boolean;
    has_uncommitted_changes: boolean;
    uncommitted_changes: string[];
    unpushed_commits: number | null;
    recent_commits: Array<{
        hash: string;
        message: string;
    }>;
    diff_stat: string;
    warnings: string[];
}
export interface GitCheckOptions {
    verbose?: boolean;
}
/**
 * Build GitCheckOutput from preflight git state and diff stat.
 * Pure function - no I/O, fully testable.
 *
 * Delegates warning generation to shared generateGitWarnings().
 */
export declare function buildGitCheckOutput(state: PreflightGitState, diffStat: string): GitCheckOutput;
/**
 * git check: gather pre-push git state in a single command.
 * Returns JSON for programmatic consumption by commit-issue / open-pr-issue.
 */
export declare function cmdGitCheck(options: GitCheckOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=check.d.ts.map