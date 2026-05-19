/**
 * PR close subcommand - Close a pull request without merging
 *
 * Closes a PR (state: closed), optionally adds a comment via --body-file,
 * and optionally deletes the remote branch via --delete-branch.
 */
import { isIssueNumber, parseIssueNumber, } from "../../utils/github.js";
import { getOctokit } from "../../utils/octokit-client.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import { STATUS_VALUES } from "../../utils/status-workflow.js";
import { getIssueDetail, resolveAndUpdateStatus, resolvePrAndUpdateStatus } from "../../utils/issue-detail.js";
import { syncParentStatus } from "../../utils/parent-status.js";
import { resolvePrFromHead, parseLinkedIssues } from "./helpers.js";
// =============================================================================
// cmdPrClose (#1617)
// =============================================================================
export async function cmdPrClose(prNumberStr, options, logger) {
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("Could not determine repository");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    // PR番号の解決: 直接指定 or --head からブランチベースで特定
    let prNumber;
    if (prNumberStr && isIssueNumber(prNumberStr)) {
        prNumber = parseIssueNumber(prNumberStr);
    }
    else if (options.head) {
        const resolved = await resolvePrFromHead(options.head, owner, repo, logger);
        if (resolved === null)
            return 1;
        prNumber = resolved;
    }
    else {
        logger.error("PR number or --head <branch> is required");
        logger.info("Usage: shirokuma-docs pr close <number>\n" +
            "       shirokuma-docs pr close --head <branch>");
        return 1;
    }
    const octokit = getOctokit();
    let headRef;
    let prBody = null;
    // Fetch PR data before closing
    try {
        const { data: prData } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });
        headRef = prData.head.ref;
        prBody = prData.body ?? null;
    }
    catch (err) {
        const status = err.status;
        if (status === 404) {
            logger.error(`PR #${prNumber} not found`);
            return 1;
        }
        // Non-404 errors: best-effort, still try to close
    }
    // Close the PR
    try {
        await octokit.rest.pulls.update({
            owner,
            repo,
            pull_number: prNumber,
            state: "closed",
        });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to close PR #${prNumber}: ${errorMsg}`);
        return 1;
    }
    logger.success(`Closed PR #${prNumber}`);
    // CLOSED（非マージ）PR は Done（#2204: Cancelled 廃止。state_reason: not_planned で識別）。
    // best-effort でクローズ自体は失敗させない。
    // PR の project item は `repository.pullRequest` クエリ経由でのみ解決できるため、
    // Issue 専用の resolveAndUpdateStatus ではなく PR 専用の resolvePrAndUpdateStatus を使う。
    try {
        const prStatusResult = await resolvePrAndUpdateStatus(owner, repo, prNumber, STATUS_VALUES.DONE, logger);
        if (!prStatusResult.success) {
            logger.warn(`PR #${prNumber}: Status を Done に更新できませんでした (${prStatusResult.reason ?? "unknown"})`);
        }
    }
    catch (err) {
        logger.warn(`PR #${prNumber}: Status を Done に更新できませんでした: ${err instanceof Error ? err.message : String(err)}`);
    }
    // PR 本文からリンク Issue を解析し、Completed のものを検出する
    // デフォルト: 警告のみ。--rollback フラグで差し戻しを実行する（best-effort）
    const linkedIssueNumbers = parseLinkedIssues(prBody);
    const linkedIssues = [];
    // 情報取得を並列化（差し戻し処理は副作用があるため逐次）
    const detailResults = await Promise.allSettled(linkedIssueNumbers.map((n) => getIssueDetail(owner, repo, n)));
    for (let i = 0; i < linkedIssueNumbers.length; i++) {
        const issueNumber = linkedIssueNumbers[i];
        const result = detailResults[i];
        if (result.status === "rejected") {
            logger.debug(`Issue #${issueNumber} の処理をスキップ: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
            continue;
        }
        const detail = result.value;
        // #2234 (F-006): ADR-v3-013 で Completed → Done のみに制限したため、
        // PR open 時の中間状態は Review に変わった。差し戻し対象を Completed と Review の両方に拡張する。
        const isRollbackTarget = detail?.status === STATUS_VALUES.COMPLETED ||
            detail?.status === STATUS_VALUES.REVIEW;
        if (!isRollbackTarget) {
            logger.debug(`Issue #${issueNumber} は ${detail?.status ?? "unknown"} のため対象外`);
            continue;
        }
        if (options.rollback) {
            try {
                await resolveAndUpdateStatus(owner, repo, issueNumber, STATUS_VALUES.IN_PROGRESS, logger);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.debug(`Issue #${issueNumber} のステータス更新をスキップ: ${msg}`);
                continue;
            }
            try {
                await syncParentStatus(owner, repo, issueNumber, logger);
            }
            catch {
                logger.debug(`Issue #${issueNumber} の親ステータス同期をスキップ`);
            }
            try {
                await octokit.rest.issues.createComment({
                    owner,
                    repo,
                    issue_number: issueNumber,
                    body: `PR #${prNumber} がクローズされたため、ステータスを In Progress に差し戻しました。`,
                });
            }
            catch {
                logger.debug(`Issue #${issueNumber} へのコメント追加をスキップ`);
            }
            linkedIssues.push({ number: issueNumber, status: STATUS_VALUES.IN_PROGRESS, rolled_back: true });
            logger.success(`Issue #${issueNumber} → In Progress (PR クローズに伴う差し戻し)`);
        }
        else {
            linkedIssues.push({ number: issueNumber, status: STATUS_VALUES.COMPLETED, rolled_back: false });
            logger.warn(`Issue #${issueNumber} は Completed のまま（--rollback で差し戻し可能）`);
        }
    }
    // Add comment if --body-file was provided (best-effort)
    let commentAdded = false;
    if (options.bodyFile) {
        try {
            await octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: prNumber,
                body: options.bodyFile,
            });
            commentAdded = true;
            logger.success(`Added comment to PR #${prNumber}`);
        }
        catch {
            logger.warn(`Failed to add comment to PR #${prNumber}`);
        }
    }
    // Delete remote branch if --delete-branch is specified (best-effort)
    let branchDeleted = false;
    if (options.deleteBranch && headRef) {
        try {
            await octokit.rest.git.deleteRef({
                owner,
                repo,
                ref: `heads/${headRef}`,
            });
            branchDeleted = true;
            logger.success(`Deleted branch ${headRef}`);
        }
        catch {
            logger.warn(`Branch deletion failed for '${headRef}' (may be from a fork)`);
        }
    }
    const output = {
        pr_number: prNumber,
        closed: true,
        branch_deleted: branchDeleted,
        comment_added: commentAdded,
        linked_issues_rolled_back: linkedIssues.some((i) => i.rolled_back),
        linked_issues: linkedIssues,
    };
    console.log(JSON.stringify(output, null, 2));
    return 0;
}
//# sourceMappingURL=close.js.map