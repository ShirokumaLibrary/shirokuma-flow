/**
 * Parent status reactive sync (#1833)
 *
 * サブ Issue のステータス変更時に親 Issue のステータスを自動導出・更新する。
 * `deriveExpectedParentStatus()` は integrity/index.ts から移動。
 * `syncParentStatus()` は各コマンドから呼び出すファサード。
 */
import { runGraphQL } from "./github.js";
import { resolveAndUpdateStatus, getIssueDetail } from "./issue-detail.js";
import { STATUS_VALUES, isBacklogEquivalent, isCancelledEquivalent } from "./status-workflow.js";
import { GRAPHQL_QUERY_SUB_ISSUES, SUB_ISSUES_GRAPHQL_HEADERS, getIssueId, } from "../commands/items/helpers.js";
import { closeIssueById } from "../commands/items/integrity/index.js";
import { removeOpenIssuesEntry } from "./github-cache.js";
// =============================================================================
// GraphQL Query - 親 Issue 番号の取得
// =============================================================================
export const GRAPHQL_QUERY_PARENT_NUMBER = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      parent {
        number
      }
    }
  }
}
`;
/**
 * 単一 Issue を `SubIssueNode` 互換シェイプで取得する GraphQL クエリ。
 * `detectApprovablePlanIssues()` に「親自身」を候補として渡すために使用する。
 */
export const GRAPHQL_QUERY_PLAN_CANDIDATE_NODE = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      number
      title
      state
      labels(first: 10) {
        nodes { name }
      }
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
`;
/**
 * 親 Issue を `SubIssueNode` 形式で取得する。
 *
 * `close` / `pr merge` で work issue 操作後に、親（計画 Issue 候補）自身を
 * `detectApprovablePlanIssues()` に渡すためのデータを取得するヘルパー。
 * `syncParentStatus().subIssueNodes` には親自身が含まれないため、ここで補完する。
 */
export async function fetchPlanCandidateNode(owner, repo, number) {
    const result = await runGraphQL(GRAPHQL_QUERY_PLAN_CANDIDATE_NODE, { owner, name: repo, number });
    if (!result.success)
        return null;
    return result.data?.data?.repository?.issue ?? null;
}
// =============================================================================
// isPlanIssue - 計画 Issue 判定ヘルパー
// =============================================================================
/**
 * ノードが計画 Issue かどうかを判定する。
 * 判定基準: `area:plan` ラベル OR タイトルが「計画:」/「Plan:」で始まる。
 * ラベルを正とし、タイトルプレフィックスはフォールバック。
 * integrity/index.ts, syncParentStatus() で共通使用。
 */
export function isPlanIssue(node) {
    const labels = (node.labels?.nodes ?? [])
        .map((l) => l?.name)
        .filter((n) => typeof n === "string");
    return isPlanIssueFromLabels(labels, node.title);
}
/**
 * `labels: string[]` 形式向けの計画 Issue 判定。
 * IssueData など labels が文字列配列の型で使用する。
 * isPlanIssue() と判定基準は同一。
 */
export function isPlanIssueFromLabels(labels, title) {
    if (labels.includes("area:plan"))
        return true;
    const t = title ?? "";
    return t.startsWith("計画:") || t.startsWith("Plan:");
}
// =============================================================================
// isDesignIssue - 設計 Issue 判定ヘルパー
// =============================================================================
/**
 * ノードが設計 Issue かどうかを判定する。
 * 判定基準: `area:design` ラベル OR タイトルが「設計:」/「Design:」で始まる。
 * ラベルを正とし、タイトルプレフィックスはフォールバック（`isPlanIssue()` と同パターン）。
 * `area:design` ラベルは現時点で未運用だが、将来追加された場合に備えてラベル優先判定を組み込む。
 */
export function isDesignIssue(node) {
    const labels = node.labels?.nodes ?? [];
    if (labels.some((l) => l?.name === "area:design"))
        return true;
    const t = node.title ?? "";
    return t.startsWith("設計:") || t.startsWith("Design:");
}
// =============================================================================
// hasIncompleteWorkSiblings - エピック判定ガード共通ヘルパー (#2112)
// =============================================================================
/**
 * state=CLOSED でも Status が未完了のままなら未完了扱いする判定用ステータス集合。
 *
 * @since #2202 READY を除外（Backlog に統合済み。CLOSED + Ready はレガシー値として完了扱い）
 * @since #2203 ON_HOLD を BLOCKED に置換（CLOSED + On Hold はレガシー値として完了扱い）
 */
const INCOMPLETE_SUB_ISSUE_STATUSES = new Set([
    STATUS_VALUES.BACKLOG,
    STATUS_VALUES.IN_PROGRESS,
    STATUS_VALUES.REVIEW,
    STATUS_VALUES.BLOCKED,
]);
/**
 * 兄弟の実作業 Issue（計画 Issue 以外）に未完了のものが存在するかを判定する。
 *
 * 計画 Issue の Close タイミングと Integration PR 自動作成条件を統一するための共通ヘルパー。
 * 呼び出し元: `closeSiblingPlanIssues()` (push/issue.ts)、`closePlanIssues()` / Integration PR 判定 (pr/merge.ts)。
 *
 * 判定基準:
 * - `state === "OPEN"` → 未完了
 * - `state === "CLOSED"` でも Status が Backlog/Ready/In Progress/Review/Blocked → 未完了（integrity 不整合の保険）
 * - Status 未設定の CLOSED ノードは完了扱い（CLOSED 単独で十分なシグナル）
 *
 * 実作業 Issue が 0 件の場合は常に `false`（通常 Issue 構成では計画 Issue を Close してよい）。
 *
 * @param excludeNumber push 中の Issue 自身を判定対象から除外するための番号。
 *        `syncParentStatus` が返す `subIssueNodes` には push 中の自身が OPEN で含まれるため、
 *        `#1932` の In Progress 遷移時フローではこの引数で自身を除外する必要がある。
 *        PR マージ後の判定（pr/merge.ts）では対象 Issue も CLOSED + Done になっているため省略可。
 */
export function hasIncompleteWorkSiblings(subIssueNodes, excludeNumber) {
    const workNodes = subIssueNodes.filter((n) => n?.number && n.number !== excludeNumber && !isPlanIssue(n));
    if (workNodes.length === 0)
        return false;
    return workNodes.some((n) => {
        if (n.state !== "CLOSED")
            return true;
        const statusName = n.projectItems?.nodes
            ?.find((pi) => pi.status?.name != null)
            ?.status?.name;
        return statusName ? INCOMPLETE_SUB_ISSUE_STATUSES.has(statusName) : false;
    });
}
// =============================================================================
// extractSubIssueStatuses - 共通ヘルパー
// =============================================================================
/**
 * Sub-Issue ノード配列から Project ステータス名を抽出する。
 * integrity/index.ts と syncParentStatus() の両方で使用される共通ロジック。
 *
 * ステータス未設定（Project 未追加 / null）のノードは Backlog として扱う (#1955)。
 * これにより、未設定ノードが集計から除外されて誤った Done 判定になることを防止する。
 */
export function extractSubIssueStatuses(nodes) {
    const statuses = [];
    for (const node of nodes) {
        const projectItems = node.projectItems?.nodes ?? [];
        const statusName = projectItems
            .find((pi) => pi.status?.name != null)
            ?.status?.name;
        statuses.push(statusName ?? STATUS_VALUES.BACKLOG);
    }
    return statuses;
}
// =============================================================================
// deriveExpectedParentStatus - Pure function
// =============================================================================
/**
 * アクティブ（進行中）とみなすステータス。
 * これらが1つでも存在する場合、親は In Progress になるべき。
 *
 * ADR-v3-013: Completed は廃止予定のため ACTIVE_STATUSES から除外。
 * Completed のみ・Completed + Done の混在は allDoneOrCompleted 条件で Review に導出される。
 *
 * @since #2202 READY / PENDING を除外（Backlog に統合。未着手扱いのためアクティブではない）
 * @since #2203 ON_HOLD を BLOCKED に置換
 */
export const ACTIVE_STATUSES = [
    STATUS_VALUES.IN_PROGRESS,
    STATUS_VALUES.REVIEW,
    STATUS_VALUES.BLOCKED,
];
/**
 * Sub-Issue のステータスリストから親 Issue の期待ステータスを導出する。
 * 導出不能な場合は null を返す。
 * Pure function。
 */
export function deriveExpectedParentStatus(subIssueStatuses) {
    if (subIssueStatuses.length === 0)
        return null;
    // #2204: Cancelled 廃止。LEGACY 値も透過マップで判定
    const allNotPlanned = subIssueStatuses.every((s) => isCancelledEquivalent(s));
    const allBacklog = subIssueStatuses.every((s) => isBacklogEquivalent(s));
    const allDoneOrCompleted = subIssueStatuses.every((s) => s === STATUS_VALUES.DONE || s === STATUS_VALUES.COMPLETED);
    const isDone = (s) => s === STATUS_VALUES.DONE;
    const allDone = subIssueStatuses.every(isDone);
    const hasDone = subIssueStatuses.some(isDone);
    const hasActive = subIssueStatuses.some((s) => ACTIVE_STATUSES.includes(s));
    // ADR-v3-013: ACTIVE_STATUSES から除外された Completed も混在時は In Progress として扱う
    const hasCompleted = subIssueStatuses.some((s) => s === STATUS_VALUES.COMPLETED);
    if (allNotPlanned || allBacklog)
        return STATUS_VALUES.BACKLOG;
    // 全サブが Completed/Done かつ Completed を含む場合 → 親を Review に
    if (allDoneOrCompleted && !allDone)
        return STATUS_VALUES.REVIEW;
    if (allDone)
        return STATUS_VALUES.DONE;
    if (hasActive)
        return STATUS_VALUES.IN_PROGRESS;
    // Completed が混在するが全完了ではない（例: Completed + Backlog 混在）→ In Progress
    if (hasCompleted)
        return STATUS_VALUES.IN_PROGRESS;
    // Done が存在するが全完了ではない（例: Done + Backlog 混在）→ In Progress (#1955)
    if (hasDone)
        return STATUS_VALUES.IN_PROGRESS;
    return null;
}
// =============================================================================
// syncParentStatus - リアクティブ自動導出
// =============================================================================
/**
 * サブ Issue のステータス変更後に親 Issue のステータスを自動導出・更新する。
 *
 * 処理フロー:
 * 1. Issue の親番号を取得
 * 2. 親の全サブ Issue ステータスを取得
 * 3. deriveExpectedParentStatus() で期待値を算出
 * 4. 差分があれば resolveAndUpdateStatus() で更新
 *
 * best-effort: エラーが発生してもログのみで続行する。
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param issueNumber - ステータスが変更されたサブ Issue の番号
 * @param logger - ロガー
 */
export async function syncParentStatus(owner, repo, issueNumber, logger) {
    try {
        // 1. 親 Issue 番号を取得
        const parentResult = await runGraphQL(GRAPHQL_QUERY_PARENT_NUMBER, { owner, name: repo, number: issueNumber });
        if (!parentResult.success) {
            logger.debug(`syncParentStatus: failed to fetch parent for #${issueNumber}`);
            return {};
        }
        const parentNumber = parentResult.data?.data?.repository?.issue?.parent?.number;
        if (!parentNumber) {
            logger.debug(`syncParentStatus: #${issueNumber} has no parent`);
            return {};
        }
        // 2. 親の全サブ Issue ステータスを取得
        const subResult = await runGraphQL(GRAPHQL_QUERY_SUB_ISSUES, { owner, name: repo, number: parentNumber }, { headers: SUB_ISSUES_GRAPHQL_HEADERS });
        if (!subResult.success) {
            logger.debug(`syncParentStatus: failed to fetch sub-issues for parent #${parentNumber}`);
            return { parentNumber };
        }
        const subIssueNodes = subResult.data?.data?.repository?.issue?.subIssues?.nodes ?? [];
        // 計画 Issue をステータス集計から除外
        const filteredNodes = subIssueNodes.filter((node) => !isPlanIssue(node));
        const subIssueStatuses = extractSubIssueStatuses(filteredNodes);
        if (subIssueStatuses.length === 0) {
            logger.debug(`syncParentStatus: no sub-issue statuses found for parent #${parentNumber}`);
            return { parentNumber, subIssueNodes };
        }
        // 3. 期待ステータスを導出
        const expectedStatus = deriveExpectedParentStatus(subIssueStatuses);
        if (!expectedStatus) {
            logger.debug(`syncParentStatus: could not derive expected status for parent #${parentNumber}`);
            return { parentNumber, subIssueNodes };
        }
        // 4. 楽観的ロック: 親の現在ステータスを再取得し、既に期待値なら更新をスキップ
        // NOTE: getIssueDetail と resolveAndUpdateStatus の間に小さな TOCTOU ウィンドウが残るが、
        // best-effort 方針として許容する。完全な排他制御は CLI のプロセス間共有の制約上コストが高い。
        const parentDetail = await getIssueDetail(owner, repo, parentNumber);
        if (parentDetail?.status === expectedStatus) {
            logger.info(`syncParentStatus: parent #${parentNumber} already ${expectedStatus}, skipping update`);
            return { parentNumber, subIssueNodes };
        }
        // 5. 差分があれば更新
        const result = await resolveAndUpdateStatus(owner, repo, parentNumber, expectedStatus, logger);
        if (result.success) {
            logger.success(`Parent #${parentNumber} → ${expectedStatus} (auto-derived)`);
        }
        else {
            logger.debug(`syncParentStatus: parent #${parentNumber} status unchanged or update skipped (${result.reason ?? "already correct"})`);
        }
        return { parentNumber, subIssueNodes };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.debug(`syncParentStatus: best-effort error for #${issueNumber}: ${msg}`);
        return {};
    }
}
// =============================================================================
// checkChildrenAllDone - 親 Done 遷移ガード
// =============================================================================
/** 未完了とみなす Project Status の集合（OPEN 状態にかかわらず）。 */
const INCOMPLETE_STATUS_SET = new Set([
    STATUS_VALUES.BACKLOG,
    STATUS_VALUES.IN_PROGRESS,
    STATUS_VALUES.REVIEW,
    STATUS_VALUES.BLOCKED,
    STATUS_VALUES.COMPLETED,
]);
/**
 * 親 Issue の全子 Issue が完了済み（Done または Cancelled 相当）かどうかを確認する。
 *
 * 判定基準:
 * - `state === "OPEN"` → 未完了
 * - `state === "CLOSED"` かつ Status が Backlog/In progress/Review/Blocked/Completed → 未完了（integrity 不整合の保険）
 * - `state === "CLOSED"` かつ Status 未設定 → 完了扱い
 * - Status が `isCancelledEquivalent()` に該当 → 完了扱い
 * - 子 Issue が 0 件 → allDone: true（ガード no-op）
 * - GraphQL 失敗 → allDone: true（best-effort、誤発動防止）
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param parentNumber - 親 Issue 番号
 * @returns CheckChildrenAllDoneResult
 */
export async function checkChildrenAllDone(owner, repo, parentNumber) {
    const emptyResult = { allDone: true, openChildren: [] };
    try {
        const subResult = await runGraphQL(GRAPHQL_QUERY_SUB_ISSUES, { owner, name: repo, number: parentNumber }, { headers: SUB_ISSUES_GRAPHQL_HEADERS });
        if (!subResult.success) {
            // best-effort: API エラーでガードが誤発動しないよう allDone: true を返す
            return emptyResult;
        }
        const nodes = subResult.data?.data?.repository?.issue?.subIssues?.nodes ?? [];
        if (nodes.length === 0)
            return emptyResult;
        const openChildren = [];
        for (const node of nodes) {
            if (!node?.number)
                continue;
            const statusName = node.projectItems?.nodes
                ?.find((pi) => pi.status?.name != null)
                ?.status?.name ?? null;
            // Cancelled 相当は完了扱い
            if (isCancelledEquivalent(statusName))
                continue;
            if (node.state === "OPEN") {
                openChildren.push({ number: node.number, status: statusName });
                continue;
            }
            // CLOSED でも未完了 Status が残っている場合は未完了扱い（integrity 不整合の保険）
            if (node.state === "CLOSED" && statusName && INCOMPLETE_STATUS_SET.has(statusName)) {
                openChildren.push({ number: node.number, status: statusName });
            }
        }
        return {
            allDone: openChildren.length === 0,
            openChildren,
        };
    }
    catch {
        // best-effort: 予期しないエラーでガードが誤発動しないよう allDone: true を返す
        return emptyResult;
    }
}
// =============================================================================
// syncChildCloseOnParentClose - 親 Close 時の子 Issue 連動 Close (ADR-v3-013)
// =============================================================================
/**
 * 親 Issue が Close されたとき、連動 Close 対象の子 Issue を Close する。
 *
 * ADR-v3-013: Done(Open) は中間状態（承認済みだが親が閉じるまで Open 維持）であり、
 * 親の Close と同時に子も Close するカスケード動作を実装する。
 *
 * 連動 Close 対象:
 * - Done(Open) の全子 Issue（従来通り）
 * - Open 状態の計画 Issue（Review/Ready/In Progress/Backlog 等、全オープン状態）
 *   計画 Issue は Done 到達前でも親 Close 時に閉じる（#2140 の拡張）。
 *   ※ ステータス列挙ではなく Open 状態を基準にすることで将来のステータス追加にも対応。
 *   ※ `classifyOrphanedPlanIssues()` は「親紐付けなし」の計画 Issue を検出する設計であり、
 *      親に紐付けられた計画 Issue の漏れ Close は本関数が担う。
 *
 * best-effort: 個別エラーは警告ログのみで処理を継続し、成功した Close のみ返す。
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param parentIssueNumber - 親 Issue 番号
 * @param logger - ロガー
 * @returns 実際に Close した子 Issue 番号の配列
 */
export async function syncChildCloseOnParentClose(owner, repo, parentIssueNumber, logger) {
    const closed = [];
    const subResult = await runGraphQL(GRAPHQL_QUERY_SUB_ISSUES, { owner, name: repo, number: parentIssueNumber }, { headers: SUB_ISSUES_GRAPHQL_HEADERS });
    if (!subResult.success) {
        logger.debug(`syncChildCloseOnParentClose: failed to fetch sub-issues for #${parentIssueNumber}`);
        return closed;
    }
    const nodes = subResult.data?.data?.repository?.issue?.subIssues?.nodes ?? [];
    const cascadeCloseTargets = nodes.filter((n) => {
        if (!n?.number || n.state === "CLOSED")
            return false;
        const statusName = n.projectItems?.nodes
            ?.find((pi) => pi.status?.name != null)
            ?.status?.name;
        // Done(Open) は常に連動 Close 対象（ADR-v3-013 基本ケース）
        if (statusName === STATUS_VALUES.DONE)
            return true;
        // Open 状態の計画 Issue も連動 Close 対象
        // ステータス列挙ではなく Open 状態を基準とし、将来のステータス追加にも対応する
        if (isPlanIssue(n))
            return true;
        return false;
    });
    const results = await Promise.all(cascadeCloseTargets.map(async (child) => {
        const childIssueId = await getIssueId(owner, repo, child.number);
        if (!childIssueId) {
            logger.warn(`syncChildCloseOnParentClose: failed to resolve ID for child #${child.number}`);
            return null;
        }
        const ok = await closeIssueById(childIssueId);
        if (ok) {
            removeOpenIssuesEntry(child.number, owner, repo);
            logger.success(`Child #${child.number} → Closed (parent #${parentIssueNumber} cascade)`);
            return child.number;
        }
        logger.warn(`Child #${child.number}: cascade close failed`);
        return null;
    }));
    for (const n of results) {
        if (n !== null)
            closed.push(n);
    }
    return closed;
}
//# sourceMappingURL=parent-status.js.map