/**
 * status approve サブコマンド
 *
 * Review ステータスの Issue を明示的に承認する。
 * - itemType === "issue" かつ fromStatus === "Review" のみ許可
 * - Review → Done に遷移（ADR-v3-022 第二改訂版 #2531: approve 意味変更）
 * - 副作用: 計画 Issue (子) の approve 後、親 Issue を Backlog → ToDo に自動同期する
 * Status 更新のみで Issue 本体はクローズしない。
 * CLOSED 化は親 Close 連動もしくは明示的な items close で行う（ADR-v3-013 / ADR-v3-014）。
 *
 * @since #2439 全 Issue Type で Review → ToDo に統一（旧: plan/design → Approved、通常 → Done）
 * @since #2532 Review → Done に変更、親 Backlog → ToDo 同期追加（ADR-v3-022 第二改訂版）
 */

import { runGraphQL, parseIssueNumber, isIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { resolveAndUpdateStatus, getIssueDetail } from "../../../utils/issue-detail.js";
import {
  syncParentStatus,
  isPlanIssue,
  isDesignIssue,
  extractSubIssueStatuses,
} from "../../../utils/parent-status.js";
import {
  STATUS_VALUES,
  isCancelledEquivalent,
} from "../../../utils/status-workflow.js";
// #2439: issue_kind は出力フィールドとして保持するが遷移先の分岐には使用しない
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

  // Issue 種別を判定（出力フィールド issue_kind の値として使用）
  const issueKind = classifyIssueKind(issue);
  // #2532: Review → Done に変更（ADR-v3-022 第二改訂版: approve 意味変更）
  const targetStatus = STATUS_VALUES.DONE;

  if (currentStatus !== STATUS_VALUES.REVIEW) {
    const result = buildErrorResult(
      number,
      currentStatus,
      targetStatus,
      `Issue #${number} は Review ステータスではありません (現在: ${currentStatus ?? "(未設定)"})。approve は Review → Done のみ許可されています（ADR-v3-022 第二改訂版）`,
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

  // 親 Issue の Backlog → ToDo 自動同期（ADR-v3-022 #2532）。
  // それ以外の親は既存の syncParentStatus に委ねる。
  if (parentNumber && parentStatus === STATUS_VALUES.BACKLOG) {
    try {
      const parentUpdateResult = await resolveAndUpdateStatus(
        owner, repo, parentNumber, STATUS_VALUES.TODO, logger
      );
      if (parentUpdateResult.success) {
        logger.success(`親 Issue #${parentNumber}: Backlog → ToDo（approve 後自動同期）`);
      } else {
        logger.warn(`親 Issue #${parentNumber} の Backlog → ToDo 同期に失敗しました（best-effort）`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`親 Issue #${parentNumber} の Backlog → ToDo 同期中にエラー（best-effort）: ${msg}`);
    }
  } else if (parentNumber) {
    await syncParentStatus(owner, repo, number, logger);
  }

  const result: ApproveResult = {
    number,
    from: currentStatus,
    to: targetStatus,
    issue_kind: issueKind,
    result: "ok",
    current_status_after_update: actualStatus,
    next_suggestions: buildNextSuggestions({ issueKind, parentNumber }),
    parent_status: parentStatus,
    sibling_statuses: siblingStatuses,
    has_plan_children: hasPlanChildren,
    has_pending_subissues: pendingSubissues.length > 0,
    pending_subissues: pendingSubissues,
  };

  logger.success(`Issue #${number}: ${currentStatus} → ${targetStatus} (承認 → Done)`);
  console.log(JSON.stringify(result, null, 2));
  return 0;
}
