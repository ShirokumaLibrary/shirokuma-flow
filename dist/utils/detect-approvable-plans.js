/**
 * detect-approvable-plans - approve 可能な計画 Issue の検出 (#2124)
 *
 * `items close` / `items pr merge` / `items dashboard` の実行後に
 * approve を促す次のアクション提案（`next_suggestions`）を生成するための Pure function 群。
 */
import { isPlanIssue, isPlanIssueFromLabels } from "./parent-status.js";
// =============================================================================
// detectApprovablePlanIssues - SubIssueNode[] を受け取るメイン関数
// =============================================================================
/**
 * 全サブ Issue が Done の計画 Issue を検出し、approve 提案文字列を生成する。
 *
 * 判定基準:
 * - isPlanIssue(node) が true（`area:plan` ラベル OR タイトルプレフィックス「計画:」/「Plan:」）
 * - state !== "CLOSED"（OPEN のまま）
 * - ステータスが Review（承認待ち状態）
 *
 * 「全サブ Issue が Done」の proxy として Review 状態を用いる前提:
 * syncParentStatus() は計画 Issue を filteredNodes から除外（parent-status.ts）するため、
 * 計画 Issue は deriveExpectedParentStatus() によって自動 Review に到達しない。
 * Review 到達は plan-issue スキル等で手動 push（items approve 相当）する経路のみ。
 * よって「計画 Issue が Review 状態」≈「approve 実行済みで全サブ完了」と解釈する。
 * この proxy 仮定を呼び出し元が把握することを意図してドキュメント化する。
 *
 * Pure function - API 呼び出しなし。
 *
 * @param planNodes - 親 Issue の全サブ Issue ノード（計画 Issue を含む全ノード）
 * @returns "items approve {n}" 形式の文字列配列
 */
export function detectApprovablePlanIssues(planNodes) {
    const suggestions = [];
    for (const node of planNodes) {
        if (!isPlanIssue(node))
            continue;
        if (node.state === "CLOSED")
            continue;
        const statusName = node.projectItems?.nodes
            ?.find((pi) => pi.status?.name != null)
            ?.status?.name;
        if (statusName !== "Review")
            continue;
        if (!node.number)
            continue;
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
export function detectApprovablePlanIssuesFromIssueData(issues) {
    const suggestions = [];
    for (const issue of issues) {
        if (!isPlanIssueFromLabels(issue.labels, issue.title))
            continue;
        if (issue.state === "CLOSED")
            continue;
        if (issue.status !== "Review")
            continue;
        suggestions.push(`items approve ${issue.number}`);
    }
    return suggestions;
}
//# sourceMappingURL=detect-approvable-plans.js.map