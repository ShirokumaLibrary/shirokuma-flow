/**
 * workflow-github-item-body-history rule（実験的）
 *
 * 本文＝最新 payload 原則の検査。本文に「履歴的記述（更新履歴・経緯・変更履歴など）」の
 * 語彙が混入していないかを最小語彙で検査する。履歴は本文ではなくコメント（Why）側に残すべき。
 *
 * 実験的ルール: 最小語彙のみを対象とし、誤検知を抑えるため warning 止まり（error 昇格はしない）。
 * 英語語彙・精密な文脈判定はスコープ外。
 *
 * 免除: ADR の Discussion は決定記録の性質上、本文に経緯・背景を含むため免除する。
 *
 * validate*（純粋）と check*（取得込み非純粋）を分離する。
 */

import type { WorkflowIssue, WorkflowIssueSeverity } from "../workflow-types.js";
import type { GitHubItemLintInput } from "../github-item-types.js";
import { isExemptFromGitHubItemChecks } from "../github-item-types.js";
import { fetchGitHubItemLintInput } from "../github-item-fetcher.js";

const RULE = "github-item-body-history";

/**
 * 履歴的記述を示す最小語彙（実験的）。
 * 本文に含まれていると「本文に履歴を書いている」可能性が高い語のみを対象とする。
 */
export const HISTORY_PATTERNS: readonly string[] = [
  "更新履歴",
  "変更履歴",
  "改訂履歴",
  "修正履歴",
];

/**
 * body-history チェックの免除判定。
 *
 * ADR の Discussion は決定の経緯・背景を本文に含むことが正当なため免除する。
 * Issue / PR / 非 ADR Discussion は非免除。
 *
 * 種別免除は comment-first と共通のため、単一正本 isExemptFromGitHubItemChecks に委譲する
 * （設計 #2821 設計判断 5）。後方互換のため本ルール専用の薄いラッパー名は維持する。
 *
 * テスト用に export。
 */
export function isExemptFromBodyHistoryCheck(item: GitHubItemLintInput): boolean {
  return isExemptFromGitHubItemChecks(item.type, item.category);
}

/**
 * 純粋検証: 本文に履歴的記述の語彙が含まれていないかを判定する。
 * テスト用に export。
 */
export function validateBodyHistory(
  item: GitHubItemLintInput,
  severity: WorkflowIssueSeverity = "warning"
): WorkflowIssue[] {
  if (isExemptFromBodyHistoryCheck(item)) return [];

  const matched = HISTORY_PATTERNS.filter((pattern) => item.body.includes(pattern));
  if (matched.length === 0) return [];

  return [
    {
      type: severity,
      message: `#${item.number}: 本文に履歴的記述（${matched.join(", ")}）が含まれています（本文＝最新 payload 原則: 履歴は本文ではなくコメントで残してください）`,
      rule: RULE,
      context: `#${item.number}`,
    },
  ];
}

/**
 * アイテムを取得して本文の履歴的記述を検査する。
 */
export async function checkBodyHistory(
  itemNumber: number,
  severity: WorkflowIssueSeverity = "warning",
  options: { public?: boolean; repo?: string } = {}
): Promise<WorkflowIssue[]> {
  const item = await fetchGitHubItemLintInput(itemNumber, options);
  if (!item) {
    return [
      {
        type: "warning",
        message: `#${itemNumber} を取得できませんでした。${RULE} チェックをスキップします。`,
        rule: RULE,
        context: `#${itemNumber}`,
      },
    ];
  }
  return validateBodyHistory(item, severity);
}
