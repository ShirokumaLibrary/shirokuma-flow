/**
 * items approve サブコマンド
 *
 * Review ステータスの Issue を明示的に承認して Done に遷移する。
 * Status 更新のみで Issue 本体はクローズしない（Done(Open) の中間状態を許容）。
 * CLOSED 化は親 Close 連動もしくは明示的な items close で行う（ADR-v3-013）。
 */
import { runGraphQL, parseIssueNumber, isIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { resolveAndUpdateStatus, getIssueDetail } from "../../../utils/issue-detail.js";
import { syncParentStatus, isPlanIssue, isDesignIssue, extractSubIssueStatuses, } from "../../../utils/parent-status.js";
import { STATUS_VALUES, isCancelledEquivalent } from "../../../utils/status-workflow.js";
import { SUB_ISSUES_GRAPHQL_HEADERS } from "../helpers.js";
import { buildNextSuggestions } from "./suggest.js";
// =============================================================================
// GraphQL: 承認に必要なコンテキストを一括取得
// =============================================================================
const GRAPHQL_QUERY_APPROVE_CONTEXT = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id
      title
      state
      labels(first: 20) {
        nodes { name }
      }
      projectItems(first: 5) {
        nodes {
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
        }
      }
      parent {
        number
        title
        projectItems(first: 5) {
          nodes {
            status: fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue { name }
            }
          }
        }
        subIssues(first: 50) {
          nodes {
            number
            title
            state
            labels(first: 10) { nodes { name } }
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
      subIssues(first: 50) {
        nodes {
          number
          title
          state
          labels(first: 10) { nodes { name } }
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
// =============================================================================
// ヘルパー
// =============================================================================
function extractFirstStatus(projectItems) {
    const items = projectItems?.nodes ?? [];
    const withStatus = items.find((p) => p?.status?.name != null);
    return withStatus?.status?.name ?? null;
}
function classifyIssueKind(node) {
    if (isPlanIssue(node))
        return "plan";
    if (isDesignIssue(node))
        return "design";
    return "normal";
}
function buildErrorResult(number, from, to, message) {
    return {
        number,
        from,
        to,
        result: "error",
        message,
        next_suggestions: [],
        parent_status: null,
        sibling_statuses: [],
        has_plan_children: false,
        has_pending_subissues: false,
        pending_subissues: [],
    };
}
// =============================================================================
// エントリポイント
// =============================================================================
export async function cmdItemApprove(numberStr, options, logger) {
    if (!isIssueNumber(numberStr)) {
        logger.error("有効な Issue 番号を指定してください");
        return 1;
    }
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("リポジトリを特定できません");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const number = parseIssueNumber(numberStr);
    // 1. 承認に必要なコンテキストを一括取得
    const contextResult = await runGraphQL(GRAPHQL_QUERY_APPROVE_CONTEXT, { owner, name: repo, number }, { headers: SUB_ISSUES_GRAPHQL_HEADERS });
    if (!contextResult.success) {
        const result = buildErrorResult(number, null, STATUS_VALUES.DONE, "Issue 情報の取得に失敗しました");
        logger.error(result.message ?? "");
        console.log(JSON.stringify(result, null, 2));
        return 1;
    }
    const issue = contextResult.data?.data?.repository?.issue;
    if (!issue) {
        const result = buildErrorResult(number, null, STATUS_VALUES.DONE, `Issue #${number} が見つかりません`);
        logger.error(result.message ?? "");
        console.log(JSON.stringify(result, null, 2));
        return 1;
    }
    const currentStatus = extractFirstStatus(issue.projectItems);
    // 2. Review ステータスのみ承認可能
    if (currentStatus !== STATUS_VALUES.REVIEW) {
        const result = buildErrorResult(number, currentStatus, STATUS_VALUES.DONE, `Issue #${number} は Review ステータスではありません (現在: ${currentStatus ?? "(未設定)"})`);
        logger.error(result.message ?? "");
        console.log(JSON.stringify(result, null, 2));
        return 1;
    }
    // 3. Issue 種別を判定
    const issueKind = classifyIssueKind(issue);
    // 4. 親情報・兄弟情報を抽出
    const parent = issue.parent ?? null;
    const parentNumber = parent?.number;
    const parentStatus = parent ? extractFirstStatus(parent.projectItems) : null;
    const siblingNodes = (parent?.subIssues?.nodes ?? []).filter((n) => typeof n?.number === "number" && n.number !== number);
    const siblingStatuses = extractSubIssueStatuses(siblingNodes);
    // 5. 承認対象 Issue のサブ Issue 情報を抽出
    const ownSubIssues = issue.subIssues?.nodes ?? [];
    const hasPlanChildren = ownSubIssues.some((n) => isPlanIssue(n));
    const pendingSubissues = [];
    for (const sub of ownSubIssues) {
        if (typeof sub?.number !== "number")
            continue;
        const subStatus = extractFirstStatus(sub.projectItems);
        // Done / Cancelled（LEGACY）ではないものを pending とみなす（Open/Close 両方対象）
        if (subStatus !== STATUS_VALUES.DONE && !isCancelledEquivalent(subStatus)) {
            pendingSubissues.push(sub.number);
        }
    }
    // 6. Review → Done に更新（Issue 本体はクローズしない）
    const updateResult = await resolveAndUpdateStatus(owner, repo, number, STATUS_VALUES.DONE, logger);
    if (!updateResult.success) {
        const result = buildErrorResult(number, currentStatus, STATUS_VALUES.DONE, `ステータスの更新に失敗しました: ${updateResult.reason ?? "unknown"}`);
        result.parent_status = parentStatus;
        result.sibling_statuses = siblingStatuses;
        result.has_plan_children = hasPlanChildren;
        result.has_pending_subissues = pendingSubissues.length > 0;
        result.pending_subissues = pendingSubissues;
        logger.error(result.message ?? "");
        console.log(JSON.stringify(result, null, 2));
        return 1;
    }
    // 7. 事後検証: GraphQL で再読み取りし、実際に Done に遷移したことを確認する
    const verifyDetail = await getIssueDetail(owner, repo, number);
    const actualStatus = verifyDetail?.status ?? null;
    if (actualStatus !== STATUS_VALUES.DONE) {
        const result = buildErrorResult(number, currentStatus, STATUS_VALUES.DONE, `ステータスの事後検証に失敗しました: 期待値 Done、実際値 ${actualStatus ?? "(未設定)"}`);
        result.current_status_after_update = actualStatus;
        result.next_suggestions = [
            `items approve ${number} を再実行`,
            `items update-status ${number} Done で手動修正`,
        ];
        result.parent_status = parentStatus;
        result.sibling_statuses = siblingStatuses;
        result.has_plan_children = hasPlanChildren;
        result.has_pending_subissues = pendingSubissues.length > 0;
        result.pending_subissues = pendingSubissues;
        logger.error(result.message ?? "");
        console.log(JSON.stringify(result, null, 2));
        return 1;
    }
    // 8. 親のリアクティブ更新（親がある場合のみ、best-effort）
    if (parentNumber) {
        await syncParentStatus(owner, repo, number, logger);
    }
    // 9. 出力ビルド
    const result = {
        number,
        from: currentStatus,
        to: STATUS_VALUES.DONE,
        result: "ok",
        current_status_after_update: actualStatus,
        next_suggestions: buildNextSuggestions({ issueKind, parentNumber }),
        parent_status: parentStatus,
        sibling_statuses: siblingStatuses,
        has_plan_children: hasPlanChildren,
        has_pending_subissues: pendingSubissues.length > 0,
        pending_subissues: pendingSubissues,
    };
    logger.success(`Issue #${number}: ${currentStatus} → ${STATUS_VALUES.DONE} (承認)`);
    console.log(JSON.stringify(result, null, 2));
    return 0;
}
//# sourceMappingURL=index.js.map