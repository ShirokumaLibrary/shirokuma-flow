/**
 * Parent status reactive sync (#1833)
 *
 * サブ Issue のステータス変更時に親 Issue のステータスを自動導出・更新する。
 * `deriveExpectedParentStatus()` は integrity/index.ts から移動。
 * `syncParentStatus()` は各コマンドから呼び出すファサード。
 */

import { runGraphQL } from "./github.js";
import { Logger } from "./logger.js";
import { resolveAndUpdateStatus, getIssueDetail } from "./issue-detail.js";
import { STATUS_VALUES, LEGACY_STATUS_VALUES, isBacklogEquivalent, isCancelledEquivalent, isInvestigationPending, isReadyForImplementation } from "./status-workflow.js";
import {
  GRAPHQL_QUERY_SUB_ISSUES,
  SUB_ISSUES_GRAPHQL_HEADERS,
  getIssueId,
} from "../commands/items/helpers.js";
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

// =============================================================================
// GraphQL Result Types
// =============================================================================

export interface ParentQueryResult {
  data?: {
    repository?: {
      issue?: {
        parent?: { number?: number } | null;
      };
    };
  };
}

export interface SubIssueNode {
  number?: number;
  title?: string;
  state?: string;
  labels?: {
    nodes?: Array<{ name?: string }>;
  };
  projectItems?: {
    nodes?: Array<{
      id?: string;
      project?: { title?: string };
      status?: { name?: string } | null;
    }>;
  };
}

export interface SubIssuesQueryResult {
  data?: {
    repository?: {
      issue?: {
        subIssues?: {
          nodes?: SubIssueNode[];
        };
        subIssuesSummary?: {
          total?: number;
        };
      };
    };
  };
}

/** syncParentStatus の戻り値 */
export interface SyncParentResult {
  parentNumber?: number;
  subIssueNodes?: SubIssueNode[];
}

/**
 * 親 Issue を `SubIssueNode` 形式で取得する。
 *
 * `close` / `pr merge` で work issue 操作後に、親（計画 Issue 候補）自身を
 * `detectApprovablePlanIssues()` に渡すためのデータを取得するヘルパー。
 * `syncParentStatus().subIssueNodes` には親自身が含まれないため、ここで補完する。
 */
export async function fetchPlanCandidateNode(
  owner: string,
  repo: string,
  number: number,
): Promise<SubIssueNode | null> {
  const result = await runGraphQL<{
    data?: { repository?: { issue?: SubIssueNode | null } };
  }>(GRAPHQL_QUERY_PLAN_CANDIDATE_NODE, { owner, name: repo, number });
  if (!result.success) return null;
  return result.data?.data?.repository?.issue ?? null;
}

// =============================================================================
// findPlanIssue / fetchPlanIssueForParent / fetchParentNumber — 計画 Issue 特定ヘルパー
// =============================================================================

/**
 * サブ Issue ノード配列から OPEN の最新計画 Issue を特定する。
 * 番号降順ソートで最新優先、CLOSED な過去計画は除外する。
 */
export function findPlanIssue(
  subIssueNodes: SubIssueNode[]
): SubIssueNode | null {
  const openPlanNodes = subIssueNodes.filter(
    (n) => n?.state === "OPEN" && isPlanIssue(n)
  );
  if (openPlanNodes.length === 0) return null;
  openPlanNodes.sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
  return openPlanNodes[0];
}

export async function fetchPlanIssueForParent(
  owner: string,
  repo: string,
  parentNumber: number,
  logger: Logger
): Promise<(SubIssueNode & { number: number }) | null> {
  try {
    const subResult = await runGraphQL<SubIssuesQueryResult>(
      GRAPHQL_QUERY_SUB_ISSUES,
      { owner, name: repo, number: parentNumber },
      { headers: SUB_ISSUES_GRAPHQL_HEADERS }
    );
    if (!subResult.success) {
      logger.debug(`fetchPlanIssueForParent: failed to fetch sub-issues for parent #${parentNumber}`);
      return null;
    }
    const nodes = subResult.data?.data?.repository?.issue?.subIssues?.nodes ?? [];
    const planNode = findPlanIssue(nodes);
    if (!planNode || !planNode.number) return null;
    return planNode as SubIssueNode & { number: number };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`fetchPlanIssueForParent: best-effort error for parent #${parentNumber}: ${msg}`);
    return null;
  }
}

export async function fetchParentNumber(
  owner: string,
  repo: string,
  issueNumber: number,
  logger: Logger
): Promise<number | null> {
  try {
    const result = await runGraphQL<ParentQueryResult>(
      GRAPHQL_QUERY_PARENT_NUMBER,
      { owner, name: repo, number: issueNumber }
    );
    if (!result.success) {
      logger.debug(`fetchParentNumber: failed to fetch parent for #${issueNumber}`);
      return null;
    }
    return result.data?.data?.repository?.issue?.parent?.number ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`fetchParentNumber: best-effort error for #${issueNumber}: ${msg}`);
    return null;
  }
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
export function isPlanIssue(node: {
  title?: string;
  labels?: { nodes?: Array<{ name?: string }> };
}): boolean {
  const labels = (node.labels?.nodes ?? [])
    .map((l) => l?.name)
    .filter((n): n is string => typeof n === "string");
  return isPlanIssueFromLabels(labels, node.title);
}

/**
 * `labels: string[]` 形式向けの計画 Issue 判定。
 * IssueData など labels が文字列配列の型で使用する。
 * isPlanIssue() と判定基準は同一。
 */
export function isPlanIssueFromLabels(labels: string[], title?: string): boolean {
  if (labels.includes("area:plan")) return true;
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
export function isDesignIssue(node: {
  title?: string;
  labels?: { nodes?: Array<{ name?: string }> };
}): boolean {
  const labels = node.labels?.nodes ?? [];
  if (labels.some((l) => l?.name === "area:design")) return true;
  const t = node.title ?? "";
  return t.startsWith("設計:") || t.startsWith("Design:");
}

// =============================================================================
// isPlanOrDesignIssue - 計画/設計 Issue 判定ラッパー (#2389)
// =============================================================================

/**
 * ノードが計画 Issue または設計 Issue かどうかを判定する。
 * `isPlanIssue(node) || isDesignIssue(node)` のラッパー。
 *
 * @since #2389
 */
export function isPlanOrDesignIssue(node: {
  title?: string;
  labels?: { nodes?: Array<{ name?: string }> };
}): boolean {
  return isPlanIssue(node) || isDesignIssue(node);
}

// =============================================================================
// hasIncompleteWorkSiblings - エピック判定ガード共通ヘルパー (#2112)
// =============================================================================

/**
 * state=CLOSED でも Status が未完了のままなら未完了扱いする判定用ステータス集合。
 *
 * @since #2202 READY を除外（Backlog に統合済み。CLOSED + Ready はレガシー値として完了扱い）
 * @since #2203 ON_HOLD を BLOCKED に置換（CLOSED + On Hold はレガシー値として完了扱い）
 * @since #2439 BACKLOG_LEGACY / APPROVED_LEGACY を追加（LEGACY 透過）、BACKLOG → TODO に改称
 */
export const INCOMPLETE_SUB_ISSUE_STATUSES: ReadonlySet<string> = new Set<string>([
  STATUS_VALUES.BACKLOG,    // 6 値モデル正規値 (#2531)
  STATUS_VALUES.TODO,
  STATUS_VALUES.IN_PROGRESS,
  STATUS_VALUES.REVIEW,
  STATUS_VALUES.BLOCKED,
  // LEGACY 透過: 旧値を持つ Issue も未完了扱い（#2440: LEGACY_STATUS_VALUES 参照に正式化）
  // #2531: BACKLOG_LEGACY 削除（Backlog は正規値に昇格）
  LEGACY_STATUS_VALUES.APPROVED_LEGACY, // "Approved" → Done 同等扱い、PR open 中の中間状態として未完了扱い継続（ADR-v3-022 第二改訂版）
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
export function hasIncompleteWorkSiblings(
  subIssueNodes: SubIssueNode[],
  excludeNumber?: number,
): boolean {
  const workNodes = subIssueNodes.filter(
    (n) => n?.number && n.number !== excludeNumber && !isPlanIssue(n),
  );
  if (workNodes.length === 0) return false;
  return workNodes.some((n) => {
    if (n.state !== "CLOSED") return true;
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
 * ステータス未設定（Project 未追加 / null）のノードは ToDo として扱う (#1955, #2439)。
 * これにより、未設定ノードが集計から除外されて誤った Done 判定になることを防止する。
 *
 * @since #2439 デフォルトを Backlog から ToDo に変更
 */
export function extractSubIssueStatuses(
  nodes: Array<{
    projectItems?: {
      nodes?: Array<{
        status?: { name?: string } | null;
      }>;
    };
  }>
): string[] {
  const statuses: string[] = [];
  for (const node of nodes) {
    const projectItems = node.projectItems?.nodes ?? [];
    const statusName = projectItems
      .find((pi) => pi.status?.name != null)
      ?.status?.name;
    statuses.push(statusName ?? STATUS_VALUES.TODO);
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
 * @since #2202 READY / PENDING を除外（Backlog に統合。未着手扱いのためアクティブではない）
 * @since #2203 ON_HOLD を BLOCKED に置換
 * @since #2439 5 値モデル移行。Completed / Approved は LEGACY 透過で処理
 */
export const ACTIVE_STATUSES: readonly string[] = [
  STATUS_VALUES.IN_PROGRESS,
  STATUS_VALUES.REVIEW,
  STATUS_VALUES.BLOCKED,
];

/**
 * Sub-Issue のステータスリストから親 Issue の期待ステータスを導出する。
 * 導出不能な場合は null を返す。
 * Pure function。
 *
 * @since #2533 6 値モデル対応（ADR-v3-022 第二改訂版）:
 *   - 全サブが Backlog（isInvestigationPending）→ 親 Backlog（未調査）
 *   - 全サブが ToDo（isReadyForImplementation）→ 親 ToDo（着手準備完了）
 *   - 旧 "allBacklog = Backlog or ToDo" 分岐を細分化
 */
export function deriveExpectedParentStatus(subIssueStatuses: string[]): string | null {
  if (subIssueStatuses.length === 0) return null;

  // #2204: Cancelled 廃止。LEGACY 値も透過マップで判定
  const allNotPlanned = subIssueStatuses.every((s) => isCancelledEquivalent(s));

  // #2533 6 値モデル対応: Backlog（未調査）と ToDo（着手準備完了）を細分化
  // 全サブが Backlog 相当（isInvestigationPending）→ 親 Backlog
  const allInvestigationPending = subIssueStatuses.every((s) => isInvestigationPending(s));
  // 全サブが ToDo 相当（isReadyForImplementation）→ 親 ToDo
  const allReadyForImplementation = subIssueStatuses.every((s) => isReadyForImplementation(s));
  // 全サブが未着手系（Backlog or ToDo、isBacklogEquivalent）→ フォールバック用
  const allBacklog = subIssueStatuses.every((s) => isBacklogEquivalent(s));

  // #2439: LEGACY 旧値（Completed / Approved）も Done 相当として扱う（親導出の安定性のため）
  // #2440: LEGACY_STATUS_VALUES 参照に正式化
  const isDoneOrLegacy = (s: string) =>
    s === STATUS_VALUES.DONE ||
    s === LEGACY_STATUS_VALUES.COMPLETED_LEGACY || // "Completed" LEGACY → Done
    s === LEGACY_STATUS_VALUES.APPROVED_LEGACY;    // "Approved" LEGACY → Done（#2531: approve 意味変更）
  const allDoneOrLegacy = subIssueStatuses.every(isDoneOrLegacy);
  const isDone = (s: string) => s === STATUS_VALUES.DONE;
  const allDone = subIssueStatuses.every(isDone);
  const hasDone = subIssueStatuses.some(isDone);
  const hasActive = subIssueStatuses.some((s) => ACTIVE_STATUSES.includes(s));
  // LEGACY: 旧 Completed / Approved が混在している場合も In Progress として扱う
  // #2440: LEGACY_STATUS_VALUES 参照に正式化
  const hasLegacyCompleted = subIssueStatuses.some(
    (s) => s === LEGACY_STATUS_VALUES.COMPLETED_LEGACY || s === LEGACY_STATUS_VALUES.APPROVED_LEGACY
  );

  if (allNotPlanned) return STATUS_VALUES.TODO;

  // 6 値モデル: 全サブが Backlog（未調査）→ 親 Backlog（#2533）
  if (allInvestigationPending) return STATUS_VALUES.BACKLOG;
  // 6 値モデル: 全サブが ToDo（着手準備完了）→ 親 ToDo（#2533）
  if (allReadyForImplementation) return STATUS_VALUES.TODO;
  // フォールバック: Backlog / ToDo 混在（isBacklogEquivalent）→ 親 Backlog（保守的）
  if (allBacklog) return STATUS_VALUES.BACKLOG;

  // 全サブが Done 系（Done / Completed-LEGACY / Approved-LEGACY）かつ全 Done ではない場合 → 親を Review に
  if (allDoneOrLegacy && !allDone) return STATUS_VALUES.REVIEW;
  if (allDone) return STATUS_VALUES.DONE;
  if (hasActive) return STATUS_VALUES.IN_PROGRESS;
  // LEGACY Completed / Approved が混在するが全完了ではない → In Progress
  if (hasLegacyCompleted) return STATUS_VALUES.IN_PROGRESS;

  // Done が存在するが全完了ではない（例: Done + ToDo 混在）→ In Progress (#1955)
  if (hasDone) return STATUS_VALUES.IN_PROGRESS;

  return null;
}

// =============================================================================
// syncParentStatus - リアクティブ自動導出
// =============================================================================

/**
 * 親 Issue を Done + Closed にするヘルパー。
 *
 * `closeIssueById`（GitHub state を Closed に）と `resolveAndUpdateStatus`（Project Status を Done に）
 * を組み合わせて state + Status の二相整合を保証する。
 *
 * best-effort: いずれかが失敗してもログのみで続行する。
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param parentNumber - Done + Closed にする親 Issue 番号
 * @param logger - ロガー
 * @returns Done + Closed に成功した場合 true
 *
 * @since #2451
 */
async function closeDoneParent(
  owner: string,
  repo: string,
  parentNumber: number,
  logger: Logger
): Promise<boolean> {
  try {
    const parentId = await getIssueId(owner, repo, parentNumber);
    if (!parentId) {
      logger.debug(`syncParentStatus: getIssueId failed for parent #${parentNumber}, falling back to status-only update`);
      // getIssueId 失敗時は Project Status のみ更新するフォールバック
      await resolveAndUpdateStatus(owner, repo, parentNumber, STATUS_VALUES.DONE, logger);
      return false;
    }

    const closed = await closeIssueById(parentId, "COMPLETED");
    if (closed) {
      removeOpenIssuesEntry(parentNumber, owner, repo);
    } else {
      logger.debug(`syncParentStatus: closeIssueById returned false for parent #${parentNumber}`);
    }
    // closeIssueById の成否に関わらず Project Status を Done に更新する（best-effort）
    await resolveAndUpdateStatus(owner, repo, parentNumber, STATUS_VALUES.DONE, logger);
    return closed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`syncParentStatus: closeDoneParent best-effort error for #${parentNumber}: ${msg}`);
    return false;
  }
}

/** syncParentStatus の最大ネスト深さ（エピック → 計画 → サブ の 2 段昇格が上限）。
 * @since #2451
 */
export const MAX_PARENT_SYNC_DEPTH = 2;

/**
 * サブ Issue のステータス変更後に親 Issue のステータスを自動導出・更新する。
 *
 * 処理フロー:
 * 1. Issue の親番号を取得
 * 2. 親の全サブ Issue ステータスを取得
 * 3. deriveExpectedParentStatus() で期待値を算出
 * 4. 期待ステータスが Done の場合は closeIssueById 経由で state + Status を二相更新（#2451 AC-A）
 *    それ以外は resolveAndUpdateStatus() で Project Status のみを更新
 * 5. Done 遷移が完了した場合、さらに上位の親も再帰的に同様の処理を実行（ネスト連鎖、#2451 AC-B）
 *    最大深さ MAX_PARENT_SYNC_DEPTH = 2 で打ち切る（3 層深さガード）
 *
 * best-effort: エラーが発生してもログのみで続行する。
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param issueNumber - ステータスが変更されたサブ Issue の番号
 * @param logger - ロガー
 * @param _visitedNumbers - ループ防止用の訪問済み Issue 番号セット（内部再帰用、外部から指定不要）
 * @param _depth - 現在のネスト深さ（内部再帰用、外部から指定不要）
 */
export async function syncParentStatus(
  owner: string,
  repo: string,
  issueNumber: number,
  logger: Logger,
  _visitedNumbers?: Set<number>,
  _depth?: number
): Promise<SyncParentResult> {
  const visited = _visitedNumbers ?? new Set<number>();
  const depth = _depth ?? 0;

  // 自己参照ループ防止: 訪問済みの Issue 番号は処理しない
  if (visited.has(issueNumber)) {
    logger.debug(`syncParentStatus: loop detected for #${issueNumber}, stopping`);
    return {};
  }
  visited.add(issueNumber);

  try {
    // 1. 親 Issue 番号を取得
    const parentResult = await runGraphQL<ParentQueryResult>(
      GRAPHQL_QUERY_PARENT_NUMBER,
      { owner, name: repo, number: issueNumber },
    );

    if (!parentResult.success) {
      logger.debug(`syncParentStatus: failed to fetch parent for #${issueNumber}`);
      return {};
    }

    const parentNumber = parentResult.data?.data?.repository?.issue?.parent?.number;
    if (!parentNumber) {
      logger.debug(`syncParentStatus: #${issueNumber} has no parent`);
      return {};
    }

    // ループ防止: 親 Issue 番号も訪問済みチェック
    if (visited.has(parentNumber)) {
      logger.debug(`syncParentStatus: loop detected (parent #${parentNumber} already visited), stopping`);
      return { parentNumber };
    }

    // 2. 親の全サブ Issue ステータスを取得
    const subResult = await runGraphQL<SubIssuesQueryResult>(
      GRAPHQL_QUERY_SUB_ISSUES,
      { owner, name: repo, number: parentNumber },
      { headers: SUB_ISSUES_GRAPHQL_HEADERS }
    );

    if (!subResult.success) {
      logger.debug(`syncParentStatus: failed to fetch sub-issues for parent #${parentNumber}`);
      return { parentNumber };
    }

    const subIssueNodes = subResult.data?.data?.repository?.issue?.subIssues?.nodes ?? [];
    // 計画 Issue をステータス集計から除外（通常パス）
    const filteredNodes = subIssueNodes.filter((node) => !isPlanIssue(node));

    // 計画 Issue 単独サブ構成の場合（エピック配下の構成）は計画 Issue を含む全サブを集計対象にする。
    // これにより「計画 Issue 全 Done → エピック Done」の 2 段昇格が機能する (#2451 AC-B2)。
    const nodesToAggregate = filteredNodes.length > 0 ? filteredNodes : subIssueNodes;
    const subIssueStatuses = extractSubIssueStatuses(nodesToAggregate);

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
    // NOTE: getIssueDetail と更新の間に小さな TOCTOU ウィンドウが残るが、
    // best-effort 方針として許容する。完全な排他制御は CLI のプロセス間共有の制約上コストが高い。
    const parentDetail = await getIssueDetail(owner, repo, parentNumber);
    if (parentDetail?.status === expectedStatus) {
      logger.info(`syncParentStatus: parent #${parentNumber} already ${expectedStatus}, skipping update`);
      return { parentNumber, subIssueNodes };
    }

    // 5. 差分があれば更新
    // Done 遷移の場合は closeIssueById 経由で state + Status の二相整合を保証する (#2451 AC-A)。
    // validateTransition は "In progress → Done" を許容するが resolveAndUpdateStatus は
    // state を変更しないため、Done 遷移時は closeIssueById で GitHub state も Closed に同期する。
    let updateSucceeded = false;
    if (expectedStatus === STATUS_VALUES.DONE) {
      const closed = await closeDoneParent(owner, repo, parentNumber, logger);
      updateSucceeded = closed;
      logger.success(`Parent #${parentNumber} → Done (auto-derived, state+Status synced)`);
    } else {
      const result = await resolveAndUpdateStatus(owner, repo, parentNumber, expectedStatus, logger);
      updateSucceeded = result.success;
      if (result.success) {
        logger.success(`Parent #${parentNumber} → ${expectedStatus} (auto-derived)`);
      } else {
        logger.debug(`syncParentStatus: parent #${parentNumber} status unchanged or update skipped (${result.reason ?? "already correct"})`);
      }
    }

    // 6. Done 遷移が完了かつ最大深さ未満の場合、さらに上位の親も連鎖処理する (#2451 AC-B)
    // サブ → 計画 Issue → エピックの 2 段昇格（MAX_PARENT_SYNC_DEPTH = 2）を上限とする。
    if (updateSucceeded && expectedStatus === STATUS_VALUES.DONE && depth < MAX_PARENT_SYNC_DEPTH) {
      logger.debug(`syncParentStatus: propagating Done to parent of #${parentNumber} (depth=${depth + 1})`);
      await syncParentStatus(owner, repo, parentNumber, logger, visited, depth + 1);
    }

    return { parentNumber, subIssueNodes };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`syncParentStatus: best-effort error for #${issueNumber}: ${msg}`);
    return {};
  }
}

// =============================================================================
// checkChildrenAllDone - 親 Done 遷移ガード
// =============================================================================

/**
 * 未完了とみなす Project Status の集合（OPEN 状態にかかわらず）。
 * @since #2439 5 値モデル移行。TODO を追加、LEGACY 旧値（Backlog / Approved / Completed）も含める
 */
export const INCOMPLETE_STATUS_SET: ReadonlySet<string> = new Set<string>([
  STATUS_VALUES.BACKLOG,    // 6 値モデル正規値 (#2531)
  STATUS_VALUES.TODO,
  STATUS_VALUES.IN_PROGRESS,
  STATUS_VALUES.REVIEW,
  STATUS_VALUES.BLOCKED,
  // LEGACY 透過: 旧値を持つ Issue も未完了扱い（#2440: LEGACY_STATUS_VALUES 参照に正式化）
  // #2531: BACKLOG_LEGACY 削除（Backlog は正規値に昇格）
  LEGACY_STATUS_VALUES.APPROVED_LEGACY,  // "Approved" → Done
  LEGACY_STATUS_VALUES.COMPLETED_LEGACY, // "Completed" → Done（PR open 中の中間状態）
]);

/** checkChildrenAllDone の戻り値 */
export interface CheckChildrenAllDoneResult {
  /** 全子が Done または Cancelled 相当であれば true */
  allDone: boolean;
  /** 未完了の子 Issue の一覧 */
  openChildren: Array<{ number: number; status: string | null }>;
}

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
export async function checkChildrenAllDone(
  owner: string,
  repo: string,
  parentNumber: number
): Promise<CheckChildrenAllDoneResult> {
  const emptyResult: CheckChildrenAllDoneResult = { allDone: true, openChildren: [] };

  try {
    const subResult = await runGraphQL<SubIssuesQueryResult>(
      GRAPHQL_QUERY_SUB_ISSUES,
      { owner, name: repo, number: parentNumber },
      { headers: SUB_ISSUES_GRAPHQL_HEADERS }
    );

    if (!subResult.success) {
      // best-effort: API エラーでガードが誤発動しないよう allDone: true を返す
      return emptyResult;
    }

    const nodes = subResult.data?.data?.repository?.issue?.subIssues?.nodes ?? [];
    if (nodes.length === 0) return emptyResult;

    const openChildren: Array<{ number: number; status: string | null }> = [];

    for (const node of nodes) {
      if (!node?.number) continue;

      const statusName =
        node.projectItems?.nodes
          ?.find((pi) => pi.status?.name != null)
          ?.status?.name ?? null;

      // Cancelled 相当は完了扱い
      if (isCancelledEquivalent(statusName)) continue;

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
  } catch {
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
 * - Done(Open) の全子 Issue（ADR-v3-013 基本ケース、後方互換）
 * - Approved(Open) の全子 Issue（#2389 LEGACY 互換: Approved → Done + Close）
 * - 上記以外の Open 子のうち `isDesignIssue(n)` で除外されないもの
 *   （計画 Issue + 実作業サブ Issue。`pr merge` / `issue close` / `issue cancel` の各経路で発火）
 *   ※ 設計 Issue は別ライフサイクルで管理されるため除外。
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
 * @param parentStateReason - 親の close 理由。子のカスケード close でも同じ理由を使う（#2329）。
 *   省略時は `COMPLETED`（既存呼び出し元の挙動を維持）
 * @returns 実際に Close した子 Issue 番号の配列
 */
export async function syncChildCloseOnParentClose(
  owner: string,
  repo: string,
  parentIssueNumber: number,
  logger: Logger,
  parentStateReason: "COMPLETED" | "NOT_PLANNED" = "COMPLETED"
): Promise<number[]> {
  const closed: number[] = [];

  const subResult = await runGraphQL<SubIssuesQueryResult>(
    GRAPHQL_QUERY_SUB_ISSUES,
    { owner, name: repo, number: parentIssueNumber },
    { headers: SUB_ISSUES_GRAPHQL_HEADERS }
  );

  if (!subResult.success) {
    logger.debug(
      `syncChildCloseOnParentClose: failed to fetch sub-issues for #${parentIssueNumber}`
    );
    return closed;
  }

  const nodes = subResult.data?.data?.repository?.issue?.subIssues?.nodes ?? [];
  const cascadeCloseTargets = nodes.filter(
    (n): n is SubIssueNode & { number: number } => {
      if (!n?.number || n.state === "CLOSED") return false;
      const statusName = n.projectItems?.nodes
        ?.find((pi) => pi.status?.name != null)
        ?.status?.name;
      // Done(Open) は常に連動 Close 対象（ADR-v3-013 基本ケース、後方互換）
      if (statusName === STATUS_VALUES.DONE) return true;
      // LEGACY: Approved(Open) も連動 Close 対象（#2389: Approved → Done + Close）
      // #2439: Approved は LEGACY 値だが既存 Issue が保持している可能性があるため継続して処理
      // #2440: LEGACY_STATUS_VALUES 参照に正式化
      if (statusName === LEGACY_STATUS_VALUES.APPROVED_LEGACY) return true;
      // 設計 Issue 以外の Open 子は連動 Close（計画 Issue・実作業サブ Issue を含む）
      return !isDesignIssue(n);
    }
  );

  const results = await Promise.all(
    cascadeCloseTargets.map(async (child) => {
      const childIssueId = await getIssueId(owner, repo, child.number);
      if (!childIssueId) {
        logger.warn(
          `syncChildCloseOnParentClose: failed to resolve ID for child #${child.number}`
        );
        return null;
      }
      const ok = await closeIssueById(childIssueId, parentStateReason);
      if (ok) {
        removeOpenIssuesEntry(child.number, owner, repo);
        // #2410: closeIssueById は GitHub state のみ更新するため、Project Status が
        // Approved や Done(Open) のまま残らないよう Done に更新する（best-effort）。
        try {
          await resolveAndUpdateStatus(owner, repo, child.number, STATUS_VALUES.DONE, logger);
        } catch (err) {
          logger.warn(
            `Child #${child.number}: Status を Done に更新できませんでした (best-effort): ${err instanceof Error ? err.message : String(err)}`
          );
        }
        logger.success(`Child #${child.number} → Closed + Done (parent #${parentIssueNumber} cascade, ${parentStateReason})`);
        return child.number;
      }
      logger.warn(`Child #${child.number}: cascade close failed`);
      return null;
    })
  );
  for (const n of results) {
    if (n !== null) closed.push(n);
  }

  return closed;
}

// =============================================================================
// 自身を親から外すヘルパー（#2252）
// =============================================================================

/**
 * cancel 対象の Issue を、その親 Issue のサブ Issue 一覧から外す。
 *
 * cancel 済み計画 Issue が親に紐付いたまま残ると、レビュー系スキルが
 * `subIssuesSummary` から古い計画を「現行計画」として誤検出する事故が起きる。
 * 親への参照（`parentIssue` フィールド）は GitHub の `removeSubIssue` mutation で解除する。
 *
 * `cmdItemClose` (issue cancel) と `actionCancel` (issue rollback --action cancel) の
 * 両方から共通利用できるよう汎用化したヘルパー。
 *
 * 第 6 引数に `prefetchedParent` を渡すと親 ID 取得用の GraphQL ラウンドトリップを
 * スキップする（#2326）。`getIssueDetail` などの呼び出しで親情報が既に手に入っている
 * ケースで指定する。
 */
export async function unparentFromOwnParent(
  owner: string,
  repo: string,
  issueNumber: number,
  issueId: string,
  logger: Logger,
  prefetchedParent?: { id: string; number: number } | null
): Promise<void> {
  const GRAPHQL_MUTATION_UNPARENT = `
mutation($issueId: ID!, $parentId: ID!) {
  removeSubIssue(input: {issueId: $issueId, parentIssueId: $parentId}) {
    issue { id number }
  }
}
`;

  let parent: { id: string; number: number } | undefined;

  if (prefetchedParent) {
    parent = prefetchedParent;
  } else if (prefetchedParent === null) {
    // 呼び出し側が「親なし」を確定的に把握している場合は API 呼び出しをスキップ
    logger.debug(`unparentFromOwnParent: #${issueNumber} has no parent (prefetched)`);
    return;
  } else {
    const GRAPHQL_QUERY_PARENT_ID = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      parent {
        id
        number
      }
    }
  }
}
`;

    interface ParentIdResult {
      data?: {
        repository?: {
          issue?: {
            parent?: { id?: string; number?: number } | null;
          };
        };
      };
    }

    const result = await runGraphQL<ParentIdResult>(
      GRAPHQL_QUERY_PARENT_ID,
      { owner, name: repo, number: issueNumber }
    );

    if (!result.success) {
      logger.debug(`unparentFromOwnParent: failed to fetch parent for #${issueNumber}`);
      return;
    }

    const fetched = result.data?.data?.repository?.issue?.parent;
    if (!fetched?.id || !fetched?.number) {
      logger.debug(`unparentFromOwnParent: #${issueNumber} has no parent`);
      return;
    }
    parent = { id: fetched.id, number: fetched.number };
  }

  interface UnparentResult {
    data?: { removeSubIssue?: { issue?: { id?: string } } };
  }

  const unparentResult = await runGraphQL<UnparentResult>(
    GRAPHQL_MUTATION_UNPARENT,
    { issueId, parentId: parent.id }
  );

  if (unparentResult.success) {
    logger.success(`Issue #${issueNumber} を親 Issue #${parent.number} から unparent しました`);
  } else {
    logger.warn(`Issue #${issueNumber} の親 Issue #${parent.number} からの unparent に失敗しました（手動で \`shirokuma-flow issue unparent ${issueNumber}\` を実行してください）`);
  }
}
