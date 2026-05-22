/**
 * detect-approvable-plans - approve 可能な計画 Issue の検出 (#2124)
 *
 * `items close` / `items pr merge` / `items dashboard` の実行後に
 * approve を促す次のアクション提案（`next_suggestions`）を生成するための Pure function 群。
 */

import { isPlanIssue, isPlanIssueFromLabels } from "./parent-status.js";
import type { IssueData } from "../commands/items/shared/session-utils.js";

// =============================================================================
// detectApprovablePlanIssues - SubIssueNode[] を受け取るメイン関数
// =============================================================================

/**
 * 承認待ち（Review）の計画 Issue を検出し、approve 提案文字列を生成する。
 *
 * 判定基準:
 * - isPlanIssue(node) が true（`area:plan` ラベル OR タイトルプレフィックス「計画:」/「Plan:」）
 * - state !== "CLOSED"（OPEN のまま）
 * - ステータスが Review（承認待ち状態）
 *
 * 検出の意味（#2689 ADR-v3-022 第四改訂版で見直し・「承認待ち Review 検出」を維持）:
 * 計画 Issue の `Review` は「計画策定が完了し承認待ち」の状態を表す。`approve` を実行すると
 * 計画 Issue は `Review → ToDo`（計画承認・着手準備完了。Done は実装フェーズで到達）に遷移する。
 * したがって「承認可能 = まだ Review にある計画 Issue」であり、本関数は Review 状態の計画 Issue を
 * 検出する。approve 後は ToDo になり Review から外れるため本関数の対象外になる（重複提案しない）。
 *
 * NOTE: 旧 docstring は「Review = approve 実行済みで全サブ完了」という Done-proxy 前提だったが、
 * 第四改訂版で approve の遷移先が Done → ToDo に変わったためその前提は失効した。検出ロジックの挙動
 * （Review を承認待ちとして検出する）は変えず、意味づけのみを「承認待ち Review 検出」に正した。
 *
 * Pure function - API 呼び出しなし。
 *
 * @param planNodes - 親 Issue の全サブ Issue ノード（計画 Issue を含む全ノード）
 * @returns "items approve {n}" 形式の文字列配列
 */
export function detectApprovablePlanIssues(
  planNodes: Array<{
    number?: number;
    title?: string;
    state?: string;
    labels?: { nodes?: Array<{ name?: string }> };
    projectItems?: { nodes?: Array<{ status?: { name?: string } | null }> };
  }>
): string[] {
  const suggestions: string[] = [];

  for (const node of planNodes) {
    if (!isPlanIssue(node)) continue;
    if (node.state === "CLOSED") continue;
    const statusName = node.projectItems?.nodes
      ?.find((pi) => pi.status?.name != null)
      ?.status?.name;
    if (statusName !== "Review") continue;
    if (!node.number) continue;

    suggestions.push(`items approve ${node.number}`);
  }

  return suggestions;
}

// =============================================================================
// detectApprovablePlanIssuesFromIssueData - IssueData[] 向け関数
// =============================================================================

/**
 * IssueData[] から approve 可能な計画 Issue を検出し、提案文字列を返す。
 * items dashboard 向け（labels が string[] 形式）。
 *
 * 判定条件は detectApprovablePlanIssues() と同一:
 * - 計画 Issue（`area:plan` ラベル OR タイトルプレフィックス「計画:」/「Plan:」）
 * - state !== "CLOSED"
 * - status === "Review"
 *
 * `IssueData.labels` は `string[]` 形式（isPlanIssue() が期待するオブジェクト形式と異なる）。
 * そのためインライン判定ロジックを使用する。
 *
 * Pure function - API 呼び出しなし。
 *
 * @param issues - IssueData[] （fetchActiveIssues() が返す形式）
 * @returns "items approve {n}" 形式の文字列配列
 */
export function detectApprovablePlanIssuesFromIssueData(
  issues: IssueData[]
): string[] {
  const suggestions: string[] = [];

  for (const issue of issues) {
    if (!isPlanIssueFromLabels(issue.labels, issue.title)) continue;
    if (issue.state === "CLOSED") continue;
    if (issue.status !== "Review") continue;

    suggestions.push(`items approve ${issue.number}`);
  }

  return suggestions;
}
