/**
 * items reopen - Issue 再オープンロジック (#1810, #2024)
 *
 * issues reopen ロジックを items サブコマンドとして提供する。
 * #2024 Phase 2-A: Cancelled → Backlog の遷移検証を追加。
 */
import { runGraphQL, parseIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { GRAPHQL_MUTATION_REOPEN_ISSUE } from "../../../utils/graphql-queries.js";
import { getIssueId } from "../helpers.js";
import { upsertOpenIssuesEntry, probeReadCache } from "../../../utils/github-cache.js";
import { resolveAndUpdateStatus, getIssueDetail } from "../../../utils/issue-detail.js";
import { validateStatusTransition, STATUS_VALUES } from "../../../utils/status-workflow.js";
// =============================================================================
// Command
// =============================================================================
/**
 * items reopen - クローズ済み Issue を再オープンする。
 */
export async function cmdItemReopen(issueNumberStr, options, logger) {
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("リポジトリを特定できません");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const issueNumber = parseIssueNumber(issueNumberStr);
    // ステータス遷移バリデーション（#2024 Phase 2-A）
    const issueDetail = await getIssueDetail(owner, repo, issueNumber);
    const currentStatus = issueDetail?.status;
    const validation = validateStatusTransition(currentStatus, STATUS_VALUES.BACKLOG);
    if (!validation.valid) {
        logger.warn(validation.warning ?? `Status transition warning: ${currentStatus} → ${STATUS_VALUES.BACKLOG}`);
    }
    const issueId = await getIssueId(owner, repo, issueNumber);
    if (!issueId) {
        logger.error(`Issue #${issueNumber} が見つかりません`);
        return 1;
    }
    const result = await runGraphQL(GRAPHQL_MUTATION_REOPEN_ISSUE, {
        issueId,
    });
    if (!result.success) {
        logger.error(`Issue #${issueNumber} の再オープンに失敗しました`);
        return 1;
    }
    logger.success(`Issue #${issueNumber} を再オープンしました`);
    // Project Status を Backlog に更新
    const statusResult = await resolveAndUpdateStatus(owner, repo, issueNumber, "Backlog", logger);
    if (statusResult.success) {
        logger.success(`Issue #${issueNumber} のステータスを Backlog に更新しました`);
    }
    else {
        logger.warn(`Issue #${issueNumber} のステータス更新に失敗しました`);
    }
    const cached = probeReadCache(issueNumber, owner, repo);
    if (cached) {
        const meta = cached.metadata;
        upsertOpenIssuesEntry({
            number: issueNumber,
            type: meta.type === "pull_request" ? "pull_request" : "issue",
            title: meta.title ?? "",
            status: "Backlog",
            priority: meta.priority,
            size: meta.size,
        }, owner, repo);
    }
    console.log(JSON.stringify({
        number: issueNumber,
        state: "OPEN",
    }, null, 2));
    return 0;
}
//# sourceMappingURL=index.js.map