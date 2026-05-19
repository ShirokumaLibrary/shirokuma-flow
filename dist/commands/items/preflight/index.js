/**
 * items preflight - セッション終了前のデータを一括取得 (#1823)
 *
 * git 状態、アクティブ Issue、マージ済み PR 検出、
 * セッションバックアップ、警告を一括取得する。
 */
import { getRepoInfo, } from "../../../utils/github.js";
import { loadGhConfig, getDefaultLimit, } from "../../../utils/gh-config.js";
import { STATUS_VALUES } from "../../../utils/status-workflow.js";
import { fetchOpenPRs } from "../../pr/helpers.js";
import { DEFAULT_EXCLUDE_STATUSES, fetchActiveIssues, getPreflightGitState, getSessionBackups, findMergedPrForIssue, generateGitWarnings, } from "../shared/session-utils.js";
// =============================================================================
// generatePreflightWarnings - Pure function
// =============================================================================
/**
 * git 状態とバックアップ数からプリフライト警告を生成する。
 * Pure function - API 呼び出しなし。
 */
export function generatePreflightWarnings(git, sessionBackups) {
    const warnings = generateGitWarnings(git, "Push before running items update-status.");
    if (sessionBackups > 0) {
        warnings.push(`${sessionBackups} PreCompact backup(s) found. A previous session may have been interrupted.`);
    }
    return warnings;
}
// =============================================================================
// cmdPreflight - メイン処理
// =============================================================================
/**
 * セッション終了前のデータを一括取得する。
 * プログラム的消費向けのフラット JSON を返す。
 */
export async function cmdPreflight(options, logger) {
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
    // 1. 拡張 git 状態
    const git = await getPreflightGitState(logger);
    logger.debug(`Branch: ${git.branch ?? "(detached)"}`);
    logger.debug(`Base branch: ${git.baseBranch ?? "(unknown)"}`);
    logger.debug(`Feature branch: ${git.isFeatureBranch}`);
    logger.debug(`Unpushed: ${git.unpushedCommits ?? "unknown"}`);
    // 2. アクティブ Issue (フラット JSON)
    const allIssues = await fetchActiveIssues(owner, repo, limit);
    const activeIssues = allIssues.filter((i) => !DEFAULT_EXCLUDE_STATUSES.includes(i.status ?? ""));
    logger.debug(`Issues: ${allIssues.length} total, ${activeIssues.length} active`);
    // 3. In Progress / Review Issue でマージ済み PR を検出
    const preflightIssues = [];
    for (const issue of activeIssues) {
        let hasMergedPr = false;
        if (issue.status === STATUS_VALUES.IN_PROGRESS || issue.status === STATUS_VALUES.REVIEW) {
            const mergedPr = await findMergedPrForIssue(owner, repo, issue.number, logger);
            hasMergedPr = mergedPr !== null;
        }
        preflightIssues.push({
            number: issue.number,
            title: issue.title,
            status: issue.status,
            merged_pr: hasMergedPr ? true : null,
        });
    }
    // 4. Open PR (フラット JSON)
    const openPRs = await fetchOpenPRs(owner, repo);
    const preflightPrs = openPRs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        review_decision: pr.reviewDecision,
    }));
    logger.debug(`Open PRs: ${openPRs.length}`);
    // 5. セッションバックアップ
    const backups = getSessionBackups();
    const sessionBackups = backups.length;
    // 6. 警告生成
    const warnings = generatePreflightWarnings(git, sessionBackups);
    for (const w of warnings) {
        logger.warn(`Warning: ${w}`);
    }
    // 7. フラット JSON 出力（仕様の snake_case フィールドにマッピング）
    const gitOutput = {
        branch: git.branch,
        base_branch: git.baseBranch,
        is_feature_branch: git.isFeatureBranch,
        uncommitted_changes: git.uncommittedChanges.length,
        unpushed_commits: git.unpushedCommits,
        recent_commits: git.recentCommits,
    };
    const output = {
        repository: `${owner}/${repo}`,
        git: gitOutput,
        issues: preflightIssues,
        pull_requests: preflightPrs,
        session_backups: sessionBackups,
        warnings,
    };
    console.log(JSON.stringify(output, null, 2));
    return 0;
}
//# sourceMappingURL=index.js.map