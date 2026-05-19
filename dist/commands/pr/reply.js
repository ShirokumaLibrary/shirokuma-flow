/**
 * PR reply subcommand - Reply to a PR review comment
 *
 * Posts a reply to an existing PR review comment thread.
 */
import { isIssueNumber, parseIssueNumber, validateBody, } from "../../utils/github.js";
import { getOctokit } from "../../utils/octokit-client.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
// =============================================================================
// cmdPrReply (#46)
// =============================================================================
export async function cmdPrReply(prNumberStr, options, logger) {
    if (!isIssueNumber(prNumberStr)) {
        logger.error(`Invalid PR number: ${prNumberStr}`);
        return 1;
    }
    if (!options.replyTo) {
        logger.error("--reply-to is required (comment database ID)");
        return 1;
    }
    // H1: Validate reply-to as numeric database ID
    if (!/^\d+$/.test(options.replyTo)) {
        logger.error(`Invalid --reply-to value: ${options.replyTo} (must be a numeric comment database ID)`);
        return 1;
    }
    if (!options.bodyFile) {
        logger.error("--body-file is required for pr-reply");
        return 1;
    }
    // H2: Validate body length
    const bodyError = validateBody(options.bodyFile);
    if (bodyError) {
        logger.error(bodyError);
        return 1;
    }
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("Could not determine repository");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const prNumber = parseIssueNumber(prNumberStr);
    const commentId = options.replyTo;
    // Use REST API to reply (simpler than GraphQL which requires pullRequestReviewId)
    let replyId = null;
    let replyUrl = null;
    try {
        const octokit = getOctokit();
        const { data } = await octokit.request("POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies", {
            owner,
            repo,
            pull_number: prNumber,
            comment_id: Number(commentId),
            body: options.bodyFile,
        });
        replyId = data.id ?? null;
        replyUrl = data.html_url ?? null;
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to reply to comment: ${errorMsg}`);
        return 1;
    }
    logger.success(`Replied to comment #${commentId} on PR #${prNumber}`);
    const output = {
        pr_number: prNumber,
        reply_to: Number(commentId),
        comment_id: replyId,
        comment_url: replyUrl,
    };
    console.log(JSON.stringify(output, null, 2));
    return 0;
}
//# sourceMappingURL=reply.js.map