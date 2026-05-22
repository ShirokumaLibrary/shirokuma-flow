/**
 * status approve サブコマンド
 *
 * Review ステータスの Issue を明示的に承認する。
 * - itemType === "issue" かつ fromStatus === "Review" のみ許可
 * - issue_kind で遷移先を分岐:
 *   - plan / design（子）→ Review → ToDo（計画/設計承認・着手準備完了。実装フェーズで Done に到達する）
 *   - normal（課題トリアージ）→ Review → ToDo（トリアージ承認・着手待ち）
 * - 副作用（plan / design）: 承認後に親 Issue を syncParentStatus 経由で子から導出・自動同期する
 *   （計画子が ToDo になるため親は ToDo / In progress 中心に導出される）
 * - 副作用（plan のみ・承認継承の下方カスケード）: 計画 Issue を approve（Review → ToDo）した時、
 *   同じ親（課題 Issue）配下の「計画 Issue 以外の子」= 実装サブ Issue で Backlog のものを
 *   Backlog → ToDo へ一括遷移させる（兄弟カスケード）。計画承認＝実装着手準備完了の継承。
 * Status 更新のみで Issue 本体はクローズしない。
 * CLOSED 化は親 Close 連動もしくは明示的な items close で行う（ADR-v3-013 / ADR-v3-014）。
 *
 * @since #2439 全 Issue Type で Review → ToDo に統一（旧: plan/design → Approved、通常 → Done）
 * @since #2532 Review → Done に変更、親 Backlog → ToDo 同期追加（ADR-v3-022 第二改訂版）
 * @since #2683 issue_kind で遷移先を分岐（plan/design = Done、normal = ToDo）（ADR-v3-022 改訂）
 * @since #2689 計画/設計子を Review → ToDo に変更（計画 Issue = 実装単位、ADR-v3-022 第四改訂版）。
 *   親同期は syncParentStatus 経由の導出に一本化。承認継承の下方カスケード（実装サブ Issue Backlog → ToDo）を追加。
 */

import { runGraphQL, parseIssueNumber, isIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { resolveAndUpdateStatus, getIssueDetail } from "../../../utils/issue-detail.js";
import {
  syncParentStatus,
  isPlanIssue,
  isDesignIssue,
  isPlanOrDesignIssue,
  extractSubIssueStatuses,
} from "../../../utils/parent-status.js";
import {
  STATUS_VALUES,
  isCancelledEquivalent,
} from "../../../utils/status-workflow.js";
// #2683: issue_kind で遷移先を分岐する（plan/design = Done、normal = ToDo）
import { SUB_ISSUES_GRAPHQL_HEADERS } from "../../items/helpers.js";
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../../items/types.js";
import { buildNextSuggestions, type IssueKind } from "./suggest.js";

// =============================================================================
// オプション型・結果型
// =============================================================================

export type ApproveOptions = ItemsOptions;

export interface ApproveResult {
  number: number;
  from: string | null;
  to: string;
  /** Issue の種別 — 遷移先分岐の根拠 (#2389: plan/design → Approved、normal → Done) */
  issue_kind: IssueKind;
  result: "ok" | "error";
  message?: string;
  /** ステータス更新後に GraphQL で再読み取りして確認した実際のステータス値 */
  current_status_after_update?: string | null;
  next_suggestions: string[];
  parent_status: string | null;
  sibling_statuses: string[];
  has_plan_children: boolean;
  has_pending_subissues: boolean;
  pending_subissues: number[];
  /** 承認継承（決定 #7・#2689）で Backlog → ToDo に遷移できた実装サブ Issue 番号 */
  cascaded_subissues?: number[];
  /** 承認継承（決定 #7・#2689）で遷移に失敗した（best-effort 失敗）実装サブ Issue 番号 */
  cascade_failed?: number[];
}

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

interface LabelNode {
  name?: string;
}

interface StatusFieldNode {
  status?: { name?: string } | null;
}

interface SubIssueContextNode {
  number?: number;
  title?: string;
  state?: string;
  labels?: { nodes?: LabelNode[] };
  projectItems?: { nodes?: StatusFieldNode[] };
}

interface ApproveContextResult {
  data?: {
    repository?: {
      issue?: {
        id?: string;
        title?: string;
        state?: string;
        labels?: { nodes?: LabelNode[] };
        projectItems?: { nodes?: StatusFieldNode[] };
        parent?: {
          number?: number;
          title?: string;
          projectItems?: { nodes?: StatusFieldNode[] };
          subIssues?: { nodes?: SubIssueContextNode[] };
        } | null;
        subIssues?: { nodes?: SubIssueContextNode[] };
      };
    };
  };
}

// =============================================================================
// ヘルパー
// =============================================================================

function extractFirstStatus(projectItems?: { nodes?: StatusFieldNode[] }): string | null {
  const items = projectItems?.nodes ?? [];
  const withStatus = items.find((p) => p?.status?.name != null);
  return withStatus?.status?.name ?? null;
}

function classifyIssueKind(node: {
  title?: string;
  labels?: { nodes?: LabelNode[] };
}): IssueKind {
  if (isPlanIssue(node)) return "plan";
  if (isDesignIssue(node)) return "design";
  return "normal";
}

function buildErrorResult(
  number: number,
  from: string | null,
  to: string,
  message: string,
  issueKind: IssueKind = "normal",
): ApproveResult {
  return {
    number,
    from,
    to,
    issue_kind: issueKind,
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

export async function cmdItemApprove(
  numberStr: string,
  options: ApproveOptions,
  logger: Logger,
): Promise<number> {
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

  const contextResult = await runGraphQL<ApproveContextResult>(
    GRAPHQL_QUERY_APPROVE_CONTEXT,
    { owner, name: repo, number },
    { headers: SUB_ISSUES_GRAPHQL_HEADERS },
  );

  if (!contextResult.success) {
    const result = buildErrorResult(number, null, STATUS_VALUES.TODO, "Issue 情報の取得に失敗しました");
    logger.error(result.message ?? "");
    console.log(JSON.stringify(result, null, 2));
    return 1;
  }

  const issue = contextResult.data?.data?.repository?.issue;
  if (!issue) {
    const result = buildErrorResult(number, null, STATUS_VALUES.TODO, `Issue #${number} が見つかりません`);
    logger.error(result.message ?? "");
    console.log(JSON.stringify(result, null, 2));
    return 1;
  }

  const currentStatus = extractFirstStatus(issue.projectItems);

  // Issue 種別を判定する（#2689 ADR-v3-022 第四改訂版: 全種別で Review → ToDo に統一）。
  // - plan / design（子）→ ToDo（計画/設計承認・着手準備完了。Done は実装フェーズで到達）
  // - normal（課題トリアージ）→ ToDo（トリアージ承認・着手待ち）
  const issueKind = classifyIssueKind(issue);
  const targetStatus = STATUS_VALUES.TODO;

  if (currentStatus !== STATUS_VALUES.REVIEW) {
    const result = buildErrorResult(
      number,
      currentStatus,
      targetStatus,
      `Issue #${number} は Review ステータスではありません (現在: ${currentStatus ?? "(未設定)"})。approve は Review からの遷移のみ許可されています（全種別で Review → ToDo）`,
      issueKind,
    );
    logger.error(result.message ?? "");
    console.log(JSON.stringify(result, null, 2));
    return 1;
  }

  const parent = issue.parent ?? null;
  const parentNumber = parent?.number;
  const parentStatus = parent ? extractFirstStatus(parent.projectItems) : null;
  const siblingNodes = (parent?.subIssues?.nodes ?? []).filter(
    (n): n is SubIssueContextNode & { number: number } =>
      typeof n?.number === "number" && n.number !== number,
  );
  const siblingStatuses = extractSubIssueStatuses(siblingNodes);

  const ownSubIssues = issue.subIssues?.nodes ?? [];
  const hasPlanChildren = ownSubIssues.some((n) => isPlanIssue(n));
  const pendingSubissues: number[] = [];
  for (const sub of ownSubIssues) {
    if (typeof sub?.number !== "number") continue;
    const subStatus = extractFirstStatus(sub.projectItems);
    // Done / Cancelled（LEGACY）ではないものを pending とみなす（Open/Close 両方対象）
    if (subStatus !== STATUS_VALUES.DONE && !isCancelledEquivalent(subStatus)) {
      pendingSubissues.push(sub.number);
    }
  }

  // Status のみ更新し Issue 本体はクローズしない（CLOSED 化は親 Close 連動または明示 close）
  const updateResult = await resolveAndUpdateStatus(owner, repo, number, targetStatus, logger);
  if (!updateResult.success) {
    const result = buildErrorResult(
      number,
      currentStatus,
      targetStatus,
      `ステータスの更新に失敗しました: ${updateResult.reason ?? "unknown"}`,
      issueKind,
    );
    result.parent_status = parentStatus;
    result.sibling_statuses = siblingStatuses;
    result.has_plan_children = hasPlanChildren;
    result.has_pending_subissues = pendingSubissues.length > 0;
    result.pending_subissues = pendingSubissues;
    logger.error(result.message ?? "");
    console.log(JSON.stringify(result, null, 2));
    return 1;
  }

  // 更新成功レスポンスとキャッシュ整合性に依存せず、GraphQL で再読み取りして実際の状態を確認する
  const verifyDetail = await getIssueDetail(owner, repo, number);
  const actualStatus = verifyDetail?.status ?? null;
  if (actualStatus !== targetStatus) {
    const result = buildErrorResult(
      number,
      currentStatus,
      targetStatus,
      `ステータスの事後検証に失敗しました: 期待値 ${targetStatus}、実際値 ${actualStatus ?? "(未設定)"}`,
      issueKind,
    );
    result.current_status_after_update = actualStatus;
    result.next_suggestions = [
      `status approve ${number} を再実行`,
      `status update-batch ${number} ${targetStatus} で手動修正`,
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

  // 承認継承の下方カスケード（決定 #7、計画 approve のみ）。
  // 計画 Issue を approve（Review → ToDo）した時、同じ親（課題 Issue）配下の
  // 「計画 Issue 以外の子」= 実装サブ Issue で Backlog のものを Backlog → ToDo に一括遷移させる。
  // 計画承認＝実装着手準備完了の継承（兄弟カスケード、#2689）。
  // 二重発火/無限ループ防止: 下方カスケードは兄弟（実装サブ Issue）のみを更新し親には触れない。
  // この後の上方向 syncParentStatus は親 Issue を子から導出するだけで、兄弟 → 親 → 兄弟の
  // 循環には入らない（syncParentStatus は子→親の上方向のみ・下方向ロジックを持たない）。
  // best-effort な兄弟遷移の成否を記録し JSON 結果に載せる（呼び出し元スキルがサイレント失敗を可視化できる）。
  const cascadedSubissues: number[] = [];
  const cascadeFailed: number[] = [];
  if (issueKind === "plan") {
    for (const sibling of siblingNodes) {
      // 計画 Issue 以外の子（実装サブ Issue）かつ Backlog のものだけが対象。
      if (isPlanOrDesignIssue(sibling)) continue;
      // CLOSED 済みの兄弟（Status が Backlog のまま残存し得る）はカスケード対象外（#2697）。
      if (sibling.state === "CLOSED") continue;
      const siblingStatus = extractFirstStatus(sibling.projectItems);
      // Backlog 限定が後退抑止を兼ねる（前進のみガード相当）。将来カスケード対象ステータスを
      // 広げる際は statusRank 前進ガードの導入を再検討する。
      if (siblingStatus !== STATUS_VALUES.BACKLOG) continue;
      try {
        const cascadeResult = await resolveAndUpdateStatus(
          owner, repo, sibling.number, STATUS_VALUES.TODO, logger
        );
        if (cascadeResult.success) {
          cascadedSubissues.push(sibling.number);
          logger.success(`実装サブ Issue #${sibling.number}: Backlog → ToDo（計画承認の継承）`);
        } else {
          cascadeFailed.push(sibling.number);
          logger.warn(`実装サブ Issue #${sibling.number} の Backlog → ToDo 継承に失敗しました（best-effort）`);
        }
      } catch (err) {
        cascadeFailed.push(sibling.number);
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`実装サブ Issue #${sibling.number} の Backlog → ToDo 継承中にエラー（best-effort）: ${msg}`);
      }
    }
  }

  // 親同期は plan / design（計画/設計子の approve）のみ。
  // normal（課題トリアージ）は課題 Issue 自身が対象であり親同期しない（#2683）。
  //
  // #2689 ADR-v3-022 第四改訂版: 計画/設計子が Review → ToDo になる新モデルでは、
  // 旧来の「親 Backlog → ToDo の直書き」をやめ、syncParentStatus 経由の子からの導出に一本化する。
  // syncParentStatus は子→親の上方向のみ。前述の下方カスケードとは方向が逆であり、
  // 兄弟 → 親 → 兄弟の循環には入らない（無限ループしない）。
  //
  // #2697: 非 Done の上位多段伝播（計画子 ToDo → 課題 → エピック）はこの approve/plan 経路に固有の要件。
  // propagateNonDone=true を明示して許可する。pr/create・pr/merge・issue/push 等の他経路は既定の
  // Done-only 伝播（#2451）を維持し、緩和の blast radius を approve に限定する。
  if (issueKind !== "normal" && parentNumber) {
    await syncParentStatus(owner, repo, number, logger, undefined, undefined, true);
  }

  const result: ApproveResult = {
    number,
    from: currentStatus,
    to: targetStatus,
    issue_kind: issueKind,
    result: "ok",
    current_status_after_update: actualStatus,
    next_suggestions: buildNextSuggestions({ issueKind, number, parentNumber }),
    parent_status: parentStatus,
    sibling_statuses: siblingStatuses,
    has_plan_children: hasPlanChildren,
    has_pending_subissues: pendingSubissues.length > 0,
    pending_subissues: pendingSubissues,
    cascaded_subissues: cascadedSubissues,
    cascade_failed: cascadeFailed,
  };

  const approveLabel =
    issueKind === "normal" ? "トリアージ承認 → ToDo" : "承認 → ToDo";
  logger.success(`Issue #${number}: ${currentStatus} → ${targetStatus} (${approveLabel})`);
  console.log(JSON.stringify(result, null, 2));
  return 0;
}
