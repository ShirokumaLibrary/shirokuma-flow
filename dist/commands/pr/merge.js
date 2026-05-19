/**
 * PR merge subcommand - Merge a pull request
 *
 * Merges a PR with configurable method (squash/merge/rebase),
 * handles branch deletion, linked issue status updates, and
 * local git operations.
 *
 * #2024 Phase 2-C: 後続処理の自動判定と次のアクション提示を追加。
 * - 計画 Issue → Done
 * - 単一計画の場合は課題 Issue → Done
 * - 全計画完了時は integration → develop の PR を自動作成
 * - 次の Ready 計画の提示
 */
import { isIssueNumber, parseIssueNumber, runGraphQL, } from "../../utils/github.js";
import { getOctokit } from "../../utils/octokit-client.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import { resolveAndUpdateStatus, updateProjectStatus, resolvePrAndUpdateStatus } from "../../utils/issue-detail.js";
import { addItemToProject, getProjectFields, } from "../../utils/project-fields.js";
import { getProjectId } from "../../utils/project-utils.js";
import { STATUS_VALUES, isBacklogEquivalent } from "../../utils/status-workflow.js";
import { execFileAsync } from "../../utils/spawn-async.js";
import { validateMergeMethod, parseMergeMethod, parseLinkedIssues, buildLinkGraph, resolvePrFromHead, } from "./helpers.js";
import { syncParentStatus, syncChildCloseOnParentClose, isPlanIssue, hasIncompleteWorkSiblings, fetchPlanCandidateNode, GRAPHQL_QUERY_PARENT_NUMBER, } from "../../utils/parent-status.js";
import { detectApprovablePlanIssues } from "../../utils/detect-approvable-plans.js";
import { GRAPHQL_QUERY_SUB_ISSUES, SUB_ISSUES_GRAPHQL_HEADERS, } from "../items/helpers.js";
// =============================================================================
// cmdMerge (#47)
// =============================================================================
export async function cmdMerge(prNumberStr, options, logger) {
    // Validate merge method exclusivity
    const mergeError = validateMergeMethod(options);
    if (mergeError) {
        logger.error(mergeError);
        return 1;
    }
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
        logger.info("Usage: shirokuma-docs pr merge <number> [--squash|--merge|--rebase]\n" +
            "       shirokuma-docs pr merge --head <branch>");
        return 1;
    }
    const mergeMethod = parseMergeMethod(options);
    const deleteBranch = options.deleteBranch !== false; // default true
    // Fetch PR body + head ref + base ref BEFORE merge (C2: post-merge fetch is fragile)
    const octokit = getOctokit();
    let linkedNumbers = [];
    let headRef;
    let baseBranch;
    let defaultBranch;
    try {
        const { data: prData } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });
        linkedNumbers = parseLinkedIssues(prData.body ?? undefined);
        headRef = prData.head.ref;
        baseBranch = prData.base.ref;
        defaultBranch = prData.base.repo?.default_branch;
    }
    catch (err) {
        const status = err.status;
        if (status === 404) {
            logger.error(`PR #${prNumber} not found`);
            return 1;
        }
        // Non-404 errors: best-effort, still try to merge
    }
    // Link graph validation (#965): detect N:N before merging
    if (linkedNumbers.length > 0 && !options.skipLinkCheck) {
        const { pattern, entries } = await buildLinkGraph(owner, repo, prNumber, linkedNumbers, logger);
        if (pattern === "N:N") {
            const output = {
                error: "N:N link graph detected",
                pattern: "N:N",
                pr_number: prNumber,
                linked_issues: linkedNumbers,
                link_graph: entries,
                message: "Complex PR-Issue relationship detected. " +
                    "Review the link graph and update issue statuses individually using " +
                    "'shirokuma-docs items push <number>' (edit frontmatter status to Done, then push). " +
                    "To merge without link check, use --skip-link-check.",
            };
            console.log(JSON.stringify(output, null, 2));
            logger.error("N:N link graph detected - merge aborted");
            return 1;
        }
        logger.debug(`Link pattern: ${pattern}`);
    }
    logger.debug(`Merging PR #${prNumber} with ${mergeMethod} method`);
    // Merge PR
    try {
        await octokit.rest.pulls.merge({
            owner,
            repo,
            pull_number: prNumber,
            merge_method: mergeMethod,
        });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to merge PR #${prNumber}: ${errorMsg}`);
        return 1;
    }
    // Delete branch (best-effort)
    if (deleteBranch && headRef) {
        try {
            await octokit.rest.git.deleteRef({
                owner,
                repo,
                ref: `heads/${headRef}`,
            });
        }
        catch {
            logger.warn(`Branch deletion failed for '${headRef}' (may be from a fork)`);
        }
    }
    logger.success(`Merged PR #${prNumber} (${mergeMethod})`);
    // Try to update linked issues to Done + autoSetTimestamps (best-effort, #676)
    const linkedIssuesUpdated = [];
    if (linkedNumbers.length > 0) {
        for (const num of linkedNumbers) {
            const result = await resolveAndUpdateStatus(owner, repo, num, "Done", logger);
            if (result.success) {
                linkedIssuesUpdated.push({ number: num, status: "Done" });
                logger.success(`Issue #${num} → Done`);
            }
        }
    }
    // PR 自身の Status 更新は best-effort — マージ成功自体は失敗させない
    try {
        const prStatusResult = await resolvePrAndUpdateStatus(owner, repo, prNumber, STATUS_VALUES.DONE, logger);
        if (!prStatusResult.success) {
            logger.warn(`PR #${prNumber}: Status を Done に更新できませんでした (${prStatusResult.reason ?? "unknown"})`);
        }
    }
    catch (err) {
        logger.warn(`PR #${prNumber}: Status を Done に更新できませんでした: ${err instanceof Error ? err.message : String(err)}`);
    }
    const syncedNumbers = new Set();
    const closedChildren = [];
    for (const updated of linkedIssuesUpdated) {
        if (syncedNumbers.has(updated.number))
            continue;
        syncedNumbers.add(updated.number);
        await syncParentStatus(owner, repo, updated.number, logger);
        const children = await syncChildCloseOnParentClose(owner, repo, updated.number, logger);
        closedChildren.push(...children);
    }
    // Explicitly close linked issues when base branch is not the default branch (#1325)
    // GitHub's native "Closes #N" auto-close only works for PRs targeting the default branch.
    // For integration branch PRs, we need to close issues explicitly.
    const issuesClosed = [];
    if (linkedNumbers.length > 0 && baseBranch && defaultBranch && baseBranch !== defaultBranch) {
        const results = await Promise.allSettled(linkedNumbers.map((num) => octokit.rest.issues
            .update({ owner, repo, issue_number: num, state: "closed" })
            .then(() => num)));
        for (const r of results) {
            if (r.status === "fulfilled") {
                issuesClosed.push(r.value);
                logger.success(`Issue #${r.value} closed (non-default base branch)`);
            }
            else {
                logger.warn(`Failed to close a linked issue`);
            }
        }
    }
    // Post-merge local git operations (best-effort)
    let checkedOut = false;
    let pulled = false;
    let localBranchDeleted = false;
    if (options.checkout !== false && baseBranch) {
        const checkoutResult = await execFileAsync("git", ["checkout", baseBranch]);
        if (checkoutResult.exitCode === 0) {
            checkedOut = true;
            logger.success(`Checked out ${baseBranch}`);
        }
        else {
            logger.warn(`Failed to checkout ${baseBranch} (uncommitted changes may exist)`);
        }
        if (checkedOut) {
            const pullResult = await execFileAsync("git", ["pull", "origin", baseBranch]);
            if (pullResult.exitCode === 0) {
                pulled = true;
            }
            else {
                logger.warn(`Failed to pull origin/${baseBranch} (network issue?)`);
            }
        }
        if (options.deleteLocal && headRef) {
            const deleteResult = await execFileAsync("git", ["branch", "-d", headRef]);
            if (deleteResult.exitCode === 0) {
                localBranchDeleted = true;
                logger.success(`Deleted local branch ${headRef}`);
            }
            else {
                logger.warn(`Failed to delete local branch '${headRef}'. Try: git branch -D ${headRef}`);
            }
        }
    }
    // 次のアクションを判定（#2024 Phase 2-C）
    let nextAction = null;
    let nextSuggestions = [];
    for (const updated of linkedIssuesUpdated) {
        // 課題 Issue の子 Issue の状態を確認
        const parentResult = await runGraphQL(GRAPHQL_QUERY_PARENT_NUMBER, { owner, name: repo, number: updated.number });
        if (!parentResult.success)
            continue;
        const parentNumber = parentResult.data?.data?.repository?.issue?.parent?.number;
        if (!parentNumber)
            continue;
        const subResult = await runGraphQL(GRAPHQL_QUERY_SUB_ISSUES, { owner, name: repo, number: parentNumber }, { headers: SUB_ISSUES_GRAPHQL_HEADERS });
        if (!subResult.success)
            continue;
        const subNodes = subResult.data?.data?.repository?.issue?.subIssues?.nodes ?? [];
        // subNodes は親の子のみで親自身を含まないため、親 plan を候補に明示追加する。
        const planCandidates = [
            ...subNodes,
        ];
        const parentPlanNode = await fetchPlanCandidateNode(owner, repo, parentNumber);
        if (parentPlanNode)
            planCandidates.push(parentPlanNode);
        nextSuggestions = detectApprovablePlanIssues(planCandidates);
        const planNodes = subNodes.filter((n) => isPlanIssue(n));
        // Integration PR 自動作成条件の厳密化 (#2112):
        // 実作業 Issue（計画 Issue 以外）全件が完了していることを hasIncompleteWorkSiblings で確認。
        // 計画 Issue の Done/Closed だけでは未完了の実作業 Issue を見逃す可能性があるため併用する。
        const allWorkClosed = !hasIncompleteWorkSiblings(subNodes);
        const unfinishedPlans = planNodes.filter((n) => {
            const status = n.projectItems?.nodes?.[0]?.status?.name;
            return status !== "Done" && n.state !== "CLOSED";
        });
        if (allWorkClosed && unfinishedPlans.length === 0) {
            // 全計画完了 → Integration PR 自動作成を試みる
            if (baseBranch && baseBranch !== defaultBranch) {
                // Integration ブランチから develop への PR を作成
                let integrationPR;
                try {
                    const { data } = await octokit.rest.pulls.create({
                        owner,
                        repo,
                        title: `feat: ${(await octokit.rest.issues.get({ owner, repo, issue_number: parentNumber })).data.title}`,
                        body: `課題 #${parentNumber} の全計画が完了しました。\n\nCloses #${parentNumber}`,
                        head: baseBranch,
                        base: defaultBranch ?? "develop",
                    });
                    integrationPR = data;
                }
                catch {
                    logger.warn("Integration PR の自動作成に失敗しました");
                }
                if (integrationPR) {
                    nextAction = {
                        type: "review-flow",
                        target: parentNumber,
                        integration_pr: integrationPR.number,
                        message: `全計画が完了しました。integration PR #${integrationPR.number} を作成しました。/review-flow #${integrationPR.number} でレビューを実行できます。`,
                    };
                    logger.success(`Integration PR #${integrationPR.number} を作成しました`);
                    const projectId = await getProjectId(owner, repo);
                    if (projectId) {
                        const projectItemId = await addItemToProject(projectId, integrationPR.node_id, logger);
                        if (projectItemId) {
                            const projectFields = await getProjectFields(projectId);
                            await updateProjectStatus({
                                projectId,
                                itemId: projectItemId,
                                statusValue: STATUS_VALUES.REVIEW,
                                projectFields,
                                logger,
                                previousStatus: undefined,
                            });
                            logger.success("Integration PR をプロジェクトに追加しました（Review）");
                        }
                    }
                }
            }
        }
        else {
            // 次の Backlog 計画を特定（番号昇順）。Pending / Ready 旧表記も Backlog 扱い
            const nextActionablePlans = unfinishedPlans
                .filter((n) => isBacklogEquivalent(n.projectItems?.nodes?.[0]?.status?.name))
                .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
            if (nextActionablePlans.length > 0 && nextActionablePlans[0].number) {
                nextAction = {
                    type: "implement-flow",
                    target: nextActionablePlans[0].number,
                    message: `次の計画 #${nextActionablePlans[0].number} が Backlog です。/implement-flow #${nextActionablePlans[0].number} で実装を開始できます。`,
                };
            }
        }
        break; // 最初のリンク Issue のみ処理
    }
    const output = {
        pr_number: prNumber,
        merged: true,
        merge_method: mergeMethod,
        branch_deleted: deleteBranch,
        linked_issues_updated: linkedIssuesUpdated,
        closed_children: closedChildren,
        issues_closed: issuesClosed,
        checked_out: checkedOut,
        pulled,
        local_branch_deleted: localBranchDeleted,
        next_action: nextAction,
        next_suggestions: nextSuggestions,
    };
    if (nextAction) {
        logger.info(`次のアクション: ${nextAction.message}`);
    }
    console.log(JSON.stringify(output, null, 2));
    return 0;
}
//# sourceMappingURL=merge.js.map