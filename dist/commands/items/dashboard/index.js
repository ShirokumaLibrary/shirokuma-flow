/**
 * items dashboard - アクティブ Issue/PR + git 状態の一括取得 (#1823)
 *
 * アクティブ Issue/PR + git 状態に特化したダッシュボードを提供する。
 */
import { loadGhConfig, getDefaultLimit, } from "../../../utils/gh-config.js";
import { getRepoInfo } from "../../../utils/github.js";
import { formatOutput, toTableJson } from "../../../utils/formatters.js";
import { fetchOpenPRs } from "../../pr/helpers.js";
import { DEFAULT_EXCLUDE_STATUSES, PROTECTED_BRANCHES, fetchActiveIssues, getPreflightGitState, getSessionBackups, } from "../shared/session-utils.js";
import { detectApprovablePlanIssuesFromIssueData } from "../../../utils/detect-approvable-plans.js";
// =============================================================================
// groupIssuesByAssignee - Pure function
// =============================================================================
/** Issue リストを担当者別にグループ化する */
export function groupIssuesByAssignee(issues) {
    const groups = {};
    for (const issue of issues) {
        if (issue.assignees.length === 0) {
            const key = "unassigned";
            if (!groups[key])
                groups[key] = [];
            groups[key].push(issue);
        }
        else {
            for (const assignee of issue.assignees) {
                if (!groups[assignee])
                    groups[assignee] = [];
                groups[assignee].push(issue);
            }
        }
    }
    return groups;
}
// =============================================================================
// cmdDashboard - メイン処理
// =============================================================================
/**
 * アクティブ Issue/PR + git 状態を一括取得して出力する。
 */
export async function cmdDashboard(options, logger) {
    const config = loadGhConfig();
    const repoInfo = getRepoInfo();
    if (!repoInfo) {
        logger.error("Could not determine repository");
        return 1;
    }
    const { owner: repoOwner, name: repo } = repoInfo;
    const owner = options.owner || repoOwner;
    const limit = getDefaultLimit(config);
    logger.debug(`Repository: ${owner}/${repo}`);
    // チームモード
    if (options.team) {
        return cmdDashboardTeam(owner, repo, limit, options, logger);
    }
    // 1. アクティブ Issue を取得
    const allIssues = await fetchActiveIssues(owner, repo, limit);
    const activeIssues = allIssues.filter((i) => !DEFAULT_EXCLUDE_STATUSES.includes(i.status ?? ""));
    logger.debug(`Issues: ${allIssues.length} total, ${activeIssues.length} active`);
    // 2. Open PR を取得
    const openPRs = await fetchOpenPRs(owner, repo);
    logger.debug(`Open PRs: ${openPRs.length}`);
    // 3. git 状態を取得
    const gitState = await getPreflightGitState(logger);
    logger.debug(`Branch: ${gitState.branch ?? "(detached)"}`);
    logger.debug(`Uncommitted changes: ${gitState.uncommittedChanges.length}`);
    // 4. ワークフロー警告
    const warnings = [];
    if (gitState.branch && PROTECTED_BRANCHES.includes(gitState.branch)) {
        warnings.push(`On protected branch "${gitState.branch}". Create a feature branch before committing.`);
        logger.warn(`Warning: On protected branch "${gitState.branch}". Create a feature branch before committing.`);
    }
    if (gitState.hasUncommittedChanges) {
        warnings.push(`${gitState.uncommittedChanges.length} uncommitted change(s) detected.`);
    }
    // 5. セッションバックアップの確認
    const backups = getSessionBackups();
    if (backups.length > 0) {
        warnings.push(`${backups.length} PreCompact backup(s) found in .claude/sessions/. A previous session may have been interrupted.`);
        logger.warn(`Found ${backups.length} PreCompact backup(s) from interrupted session(s)`);
    }
    // 6. 出力ビルド
    const issueColumns = ["number", "title", "status", "priority", "size", "assignees", "labels"];
    const prColumns = ["number", "title", "review_decision", "review_thread_count", "review_count"];
    // git 出力を仕様の snake_case フィールドにマッピング
    const gitOutput = {
        branch: gitState.branch,
        base_branch: gitState.baseBranch,
        is_feature_branch: gitState.isFeatureBranch,
        uncommitted_changes: gitState.uncommittedChanges.length,
        unpushed_commits: gitState.unpushedCommits,
    };
    const nextSuggestions = detectApprovablePlanIssuesFromIssueData(allIssues);
    const output = {
        repository: `${owner}/${repo}`,
        warnings: warnings.length > 0 ? warnings : undefined,
        git: gitOutput,
        backups: backups.length > 0
            ? {
                count: backups.length,
                latest: {
                    filename: backups[0].filename,
                    timestamp: backups[0].timestamp,
                    content: backups[0].content,
                },
            }
            : undefined,
        issues: toTableJson(activeIssues.map((i) => ({
            number: i.number,
            title: i.title,
            status: i.status,
            priority: i.priority,
            size: i.size,
            assignees: i.assignees,
            labels: i.labels,
        })), issueColumns),
        total_issues: activeIssues.length,
        openPRs: toTableJson(openPRs.map((pr) => ({
            number: pr.number,
            title: pr.title,
            review_decision: pr.reviewDecision,
            review_thread_count: pr.reviewThreadCount,
            review_count: pr.reviewCount,
        })), prColumns),
        next_suggestions: nextSuggestions,
    };
    const outputFormat = options.format ?? "json";
    const formatted = formatOutput(output, outputFormat);
    console.log(formatted);
    return 0;
}
// =============================================================================
// チームダッシュボードモード
// =============================================================================
/**
 * チームダッシュボード: 全メンバーの Issue を担当者別に表示する。
 */
async function cmdDashboardTeam(owner, repo, limit, options, logger) {
    logger.debug("Team dashboard mode");
    // 1. アクティブ Issue を取得
    const allIssues = await fetchActiveIssues(owner, repo, limit);
    const activeIssues = allIssues.filter((i) => !DEFAULT_EXCLUDE_STATUSES.includes(i.status ?? ""));
    // 2. 担当者別にグループ化
    const issuesByAssignee = groupIssuesByAssignee(activeIssues);
    // 3. Open PR を取得
    const openPRs = await fetchOpenPRs(owner, repo);
    // 4. チームダッシュボード出力ビルド
    const issueColumns = ["number", "title", "status", "priority", "size"];
    const allMembers = new Set(Object.keys(issuesByAssignee));
    const memberDashboards = {};
    for (const member of allMembers) {
        const memberIssues = issuesByAssignee[member] ?? [];
        memberDashboards[member] = {
            issues: toTableJson(memberIssues.map((i) => ({
                number: i.number,
                title: i.title,
                status: i.status,
                priority: i.priority,
                size: i.size,
            })), issueColumns),
            issue_count: memberIssues.length,
        };
    }
    const prColumns = ["number", "title", "review_decision", "review_thread_count", "review_count"];
    const output = {
        repository: `${owner}/${repo}`,
        mode: "team",
        members: memberDashboards,
        total_members: allMembers.size,
        total_issues: activeIssues.length,
        openPRs: toTableJson(openPRs.map((pr) => ({
            number: pr.number,
            title: pr.title,
            review_decision: pr.reviewDecision,
            review_thread_count: pr.reviewThreadCount,
            review_count: pr.reviewCount,
        })), prColumns),
    };
    const outputFormat = options.format ?? "json";
    const formatted = formatOutput(output, outputFormat);
    console.log(formatted);
    return 0;
}
//# sourceMappingURL=index.js.map