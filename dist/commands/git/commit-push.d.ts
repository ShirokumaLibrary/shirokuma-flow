/**
 * git commit-push - Stage, commit, and push in a single command
 *
 * Consolidates git add + commit + push into one operation for AI agents,
 * reducing context window usage (3 commands → 1).
 *
 * Usage:
 *   shirokuma-docs git commit-push -m "fix: タイポを修正" --issue 1416
 *   shirokuma-docs git commit-push -m "fix: タイポを修正" -f src/index.ts -f src/utils.ts
 */
import { Logger } from "../../utils/logger.js";
export interface CommitPushOptions {
    message: string;
    files?: string[];
    issue?: number;
    verbose?: boolean;
}
export interface CommitPushResult {
    branch: string | null;
    commit_hash: string;
    commit_message: string;
    files_staged: string[];
    pushed: boolean;
    error?: string;
}
/**
 * Build commit message, optionally appending issue reference (#N).
 * Skips appending if the reference already exists in the message.
 *
 * @param message - Base commit message
 * @param issue - Issue number to append as (#N), or undefined to skip
 * @returns Commit message with optional issue reference
 */
export declare function buildCommitMessage(message: string, issue: number | undefined): string;
/**
 * Assemble CommitPushResult from commit operation data.
 * Pure function - no I/O, fully testable.
 *
 * @param args - Commit operation data fields
 * @returns Structured result for JSON output
 */
export declare function buildCommitPushResult(args: {
    branch: string | null;
    commitHash: string;
    commitMessage: string;
    filesStaged: string[];
    pushed: boolean;
    error?: string;
}): CommitPushResult;
/**
 * git commit-push: stage, commit, and push in one operation.
 * Skips push when on a protected branch (develop, main).
 * Returns JSON for programmatic consumption by AI agents.
 *
 * @param options - Command options (message, files, issue, verbose)
 * @param logger - Logger instance for debug/warn output
 * @returns Exit code (0 = success, 1 = error)
 */
export declare function cmdGitCommitPush(options: CommitPushOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=commit-push.d.ts.map