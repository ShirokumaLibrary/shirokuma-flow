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
import { simpleGit } from "simple-git";
import { PROTECTED_BRANCHES } from "../items/shared/session-utils.js";
// =============================================================================
// buildCommitMessage - Pure function (testable)
// =============================================================================
/**
 * Build commit message, optionally appending issue reference (#N).
 * Skips appending if the reference already exists in the message.
 *
 * @param message - Base commit message
 * @param issue - Issue number to append as (#N), or undefined to skip
 * @returns Commit message with optional issue reference
 */
export function buildCommitMessage(message, issue) {
    if (issue === undefined)
        return message;
    const ref = `(#${issue})`;
    if (message.includes(ref))
        return message;
    return `${message} ${ref}`;
}
// =============================================================================
// buildCommitPushResult - Pure function (testable)
// =============================================================================
/**
 * Assemble CommitPushResult from commit operation data.
 * Pure function - no I/O, fully testable.
 *
 * @param args - Commit operation data fields
 * @returns Structured result for JSON output
 */
export function buildCommitPushResult(args) {
    const result = {
        branch: args.branch,
        commit_hash: args.commitHash,
        commit_message: args.commitMessage,
        files_staged: args.filesStaged,
        pushed: args.pushed,
    };
    if (args.error !== undefined)
        result.error = args.error;
    return result;
}
// =============================================================================
// cmdGitCommitPush - Command handler
// =============================================================================
/**
 * git commit-push: stage, commit, and push in one operation.
 * Skips push when on a protected branch (develop, main).
 * Returns JSON for programmatic consumption by AI agents.
 *
 * @param options - Command options (message, files, issue, verbose)
 * @param logger - Logger instance for debug/warn output
 * @returns Exit code (0 = success, 1 = error)
 */
export async function cmdGitCommitPush(options, logger) {
    const git = simpleGit();
    // 1. Get current branch
    const branchSummary = await git.branch();
    const branch = branchSummary.current || null;
    logger.debug(`Branch: ${branch ?? "(detached)"}`);
    const isProtected = branch !== null && PROTECTED_BRANCHES.includes(branch);
    if (isProtected) {
        logger.warn(`On protected branch "${branch}". Push will be skipped.`);
    }
    // 2. Stage files
    const filesArg = options.files && options.files.length > 0 ? options.files : ["."];
    await git.add(filesArg);
    // Collect staged file list for output
    const statusSummary = await git.status();
    const filesStaged = statusSummary.staged;
    logger.debug(`Staged files: ${filesStaged.join(", ") || "(none)"}`);
    if (filesStaged.length === 0) {
        logger.warn("Nothing to commit: no staged changes after git add.");
        console.log(JSON.stringify({ error: "nothing to commit", files_staged: [] }, null, 2));
        return 1;
    }
    // 3. Build commit message
    const commitMessage = buildCommitMessage(options.message, options.issue);
    logger.debug(`Commit message: ${commitMessage}`);
    // 4. Commit
    let commitHash;
    try {
        const commitResult = await git.commit(commitMessage);
        commitHash = (commitResult.commit ?? "").substring(0, 7);
        logger.debug(`Committed: ${commitHash}`);
    }
    catch (e) {
        logger.warn(`Commit failed: ${String(e)}`);
        console.log(JSON.stringify({ error: `commit failed: ${String(e)}`, files_staged: filesStaged }, null, 2));
        return 1;
    }
    // 5. Push (skip on protected branches)
    let pushed = false;
    let pushError;
    if (!isProtected && branch) {
        try {
            await git.push("origin", branch, ["--set-upstream"]);
            pushed = true;
            logger.debug(`Pushed to origin/${branch}`);
        }
        catch (e) {
            pushError = String(e);
            logger.warn(`Push failed: ${String(e)}`);
        }
    }
    // 6. Build and print result
    const result = buildCommitPushResult({
        branch,
        commitHash,
        commitMessage,
        filesStaged,
        pushed,
        error: pushError,
    });
    console.log(JSON.stringify(result, null, 2));
    return pushError !== undefined ? 1 : 0;
}
//# sourceMappingURL=commit-push.js.map