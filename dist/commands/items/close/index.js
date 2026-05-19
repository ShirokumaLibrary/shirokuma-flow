/**
 * items close/cancel - Issue クローズロジック (#1810, #2024)
 *
 * issues close/cancel ロジックを items サブコマンドとして提供する。
 * #2024 Phase 2-A: validateStatusTransition による遷移検証を追加。
 * cancel 時の子 Issue 自動 unparent を追加。
 */
import { runGraphQL, parseIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { GRAPHQL_MUTATION_ADD_COMMENT, GRAPHQL_MUTATION_CLOSE_ISSUE, } from "../../../utils/graphql-queries.js";
import { resolveAndUpdateStatus, getIssueDetail } from "../../../utils/issue-detail.js";
import { getIssueId } from "../helpers.js";
import { syncParentStatus, syncChildCloseOnParentClose, fetchPlanCandidateNode, checkChildrenAllDone, } from "../../../utils/parent-status.js";
import { detectApprovablePlanIssues } from "../../../utils/detect-approvable-plans.js";
import { removeOpenIssuesEntry } from "../../../utils/github-cache.js";
import { validateStatusTransition, STATUS_VALUES } from "../../../utils/status-workflow.js";
// =============================================================================
// Command
// =============================================================================
/**
 * items close/cancel - Issue をクローズする。
 * stateReason が NOT_PLANNED の場合は cancel 動作。
 */
export async function cmdItemClose(issueNumberStr, options, logger) {
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
    // #2204: Cancelled を廃止。NOT_PLANNED も Done に統合（state_reason で識別）
    const expectedTargetStatus = STATUS_VALUES.DONE;
    const validation = validateStatusTransition(currentStatus, expectedTargetStatus);
    if (!validation.valid) {
        // 警告のみ（ブロックしない）
        logger.warn(validation.warning ?? `Status transition warning: ${currentStatus} → ${expectedTargetStatus}`);
    }
    // 親 Issue の Done 遷移ガード（cancel = NOT_PLANNED 経路はスキップ、--force で API call ごと省略）
    if (options.stateReason !== "NOT_PLANNED") {
        if (options.force) {
            logger.warn("--force: 子 Issue 未完了ガードをバイパスして強制クローズします");
        }
        else {
            const check = await checkChildrenAllDone(owner, repo, issueNumber);
            if (!check.allDone) {
                const nums = check.openChildren.map((c) => `#${c.number}`).join(", ");
                logger.error(`子 Issue ${nums} が未完了です。全子 Issue の完了後に再実行してください（強制する場合は --force）`);
                return 4;
            }
        }
    }
    // cancel 時の子 Issue 自動 unparent（#2024 Phase 2-A）
    if (options.stateReason === "NOT_PLANNED") {
        await unparentChildIssues(owner, repo, issueNumber, logger);
    }
    // Issue の GraphQL ID を取得
    const issueId = await getIssueId(owner, repo, issueNumber);
    if (!issueId) {
        logger.error(`Issue #${issueNumber} が見つかりません`);
        return 1;
    }
    // --body-file が指定された場合はクローズコメントを追加
    if (options.bodyFile) {
        const commentResult = await runGraphQL(GRAPHQL_MUTATION_ADD_COMMENT, {
            subjectId: issueId,
            body: options.bodyFile,
        });
        if (commentResult.success) {
            logger.success(`Issue #${issueNumber} にクローズコメントを追加しました`);
        }
        else {
            logger.warn("クローズコメントの追加に失敗しました。クローズ処理は続行します");
        }
    }
    // クローズ理由を決定
    const stateReason = options.stateReason === "NOT_PLANNED" ? "NOT_PLANNED" : "COMPLETED";
    const result = await runGraphQL(GRAPHQL_MUTATION_CLOSE_ISSUE, {
        issueId,
        stateReason,
    });
    if (!result.success) {
        logger.error(`Issue #${issueNumber} のクローズに失敗しました`);
        return 1;
    }
    logger.success(`Issue #${issueNumber} をクローズしました (${stateReason})`);
    // ステータス自動更新（NOT_PLANNED も Done に統合。state_reason で識別）
    const targetStatus = options.fieldStatus ? options.fieldStatus : STATUS_VALUES.DONE;
    const statusResult = await resolveAndUpdateStatus(owner, repo, issueNumber, targetStatus, logger);
    const statusUpdated = statusResult.success;
    if (statusUpdated) {
        logger.success(`Issue #${issueNumber} → ${targetStatus}`);
    }
    else {
        logger.warn(`Issue #${issueNumber}: Status 更新をスキップ (${statusResult.reason ?? "unknown"})`);
    }
    const syncResult = await syncParentStatus(owner, repo, issueNumber, logger);
    const closedChildren = await syncChildCloseOnParentClose(owner, repo, issueNumber, logger);
    removeOpenIssuesEntry(issueNumber, owner, repo);
    // syncParentStatus().subIssueNodes は親の子のみで親自身を含まないため、
    // work issue close 時に親 plan を approve 提案に拾うには親を明示的に取得する必要がある。
    const planCandidates = [...(syncResult.subIssueNodes ?? [])];
    if (syncResult.parentNumber) {
        const parentNode = await fetchPlanCandidateNode(owner, repo, syncResult.parentNumber);
        if (parentNode)
            planCandidates.push(parentNode);
    }
    const nextSuggestions = detectApprovablePlanIssues(planCandidates);
    console.log(JSON.stringify({
        number: issueNumber,
        state: "CLOSED",
        stateReason,
        status: statusUpdated ? targetStatus : undefined,
        closed_children: closedChildren,
        next_suggestions: nextSuggestions,
    }, null, 2));
    return 0;
}
// =============================================================================
// 子 Issue unparent ヘルパー（#2024 Phase 2-A）
// =============================================================================
/**
 * 子 Issue を一括 unparent する（cancel 時の自動クリーンアップ）
 *
 * ADR-v3-013: Done(Open) 子は `syncChildCloseOnParentClose()` で連動 Close するため、
 * 本処理では unparent 対象から除外する（Backlog / In Progress / Review 等の未完了子のみ対象）。
 */
async function unparentChildIssues(owner, repo, issueNumber, logger) {
    const GRAPHQL_QUERY_SUB_ISSUES_WITH_STATUS = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id
      subIssues(first: 50) {
        nodes {
          id
          number
          state
          projectItems(first: 5) {
            nodes {
              status: fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
            }
          }
        }
      }
    }
  }
}
`;
    const GRAPHQL_MUTATION_UNPARENT = `
mutation($issueId: ID!, $parentId: ID!) {
  removeSubIssue(input: {issueId: $issueId, parentIssueId: $parentId}) {
    issue { id number }
  }
}
`;
    const result = await runGraphQL(GRAPHQL_QUERY_SUB_ISSUES_WITH_STATUS, { owner, name: repo, number: issueNumber });
    if (!result.success)
        return;
    const issue = result.data?.data?.repository?.issue;
    if (!issue?.id)
        return;
    const allSubs = issue.subIssues?.nodes ?? [];
    // Done(Open) の子は syncChildCloseOnParentClose に委ねるため除外
    const subIssues = allSubs.filter((sub) => {
        if (sub.state === "CLOSED")
            return false;
        const status = sub.projectItems?.nodes?.find((pi) => pi.status?.name != null)?.status?.name;
        return status !== STATUS_VALUES.DONE;
    });
    if (subIssues.length === 0)
        return;
    logger.info(`Issue #${issueNumber}: ${subIssues.length} 件の子 Issue を unparent します`);
    for (const sub of subIssues) {
        if (!sub.id || !sub.number)
            continue;
        const unparentResult = await runGraphQL(GRAPHQL_MUTATION_UNPARENT, { issueId: sub.id, parentId: issue.id });
        if (unparentResult.success) {
            logger.success(`子 Issue #${sub.number} を unparent しました`);
        }
        else {
            logger.warn(`子 Issue #${sub.number} の unparent に失敗しました`);
        }
    }
}
//# sourceMappingURL=index.js.map