/**
 * workflow-github-item-comment-first rule
 *
 * 「本文＝最新 payload / コメント＝Why」原則の検査。
 * 本文が更新された後に Why を説明するコメントが付いていない（= 本文更新の最古コメントが
 * 本文の最終更新より後に作成されている）ケースを warning で示す。
 *
 * 免除条件:
 *   #0: ADR の Discussion（本文 = Why payload のため。設計 #2821 設計判断 5・両ルール共通）
 *   #1: コメント0件（初回作成直後で Why コメントを付ける余地がまだない）
 *   #2: createdAt === updatedAt（本文が一度も更新されていない）
 *
 * 検出限界（ヒューリスティック）: comments[0].createdAt > updatedAt は「最古コメント vs
 * 最新本文更新」の比較のため、本文を複数回更新し最後の更新に対応する Why コメントが
 * 無いケースは検出できない（最古コメントが過去の更新より後であれば違反としない）。
 *
 * validate*（純粋）と check*（取得込み非純粋）を分離する。
 */

import type { WorkflowIssue, WorkflowIssueSeverity } from "../workflow-types.js";
import type { GitHubItemLintInput } from "../github-item-types.js";
import { isExemptFromGitHubItemChecks } from "../github-item-types.js";
import { fetchGitHubItemLintInput } from "../github-item-fetcher.js";

const RULE = "github-item-comment-first";

/**
 * 純粋検証: アイテムがコメントファースト原則に沿うかを判定する。
 * テスト用に export。
 */
export function validateCommentFirst(
  item: GitHubItemLintInput,
  severity: WorkflowIssueSeverity = "warning"
): WorkflowIssue[] {
  // 免除#0: ADR の Discussion（設計 #2821 設計判断 5・両ルール共通の種別免除）
  if (isExemptFromGitHubItemChecks(item.type, item.category)) return [];

  // 免除#1: コメント0件（初回作成直後）
  if (item.comments.length === 0) return [];

  // 免除#2: 本文が未更新（createdAt === updatedAt）
  if (item.createdAt === item.updatedAt) return [];

  // comments(first: 100) は CREATED_AT 昇順で返るため comments[0] が最古
  const oldest = item.comments[0];
  const oldestTime = Date.parse(oldest.createdAt);
  const updatedTime = Date.parse(item.updatedAt);

  // 日時パース不能時は判定不能としてスキップ（誤検知を避ける）
  if (Number.isNaN(oldestTime) || Number.isNaN(updatedTime)) return [];

  // 最古コメントが本文の最終更新より後 = 本文更新後に Why が記録されていない可能性
  if (oldestTime > updatedTime) {
    return [
      {
        type: severity,
        message: `#${item.number}: 本文が更新された後に Why を説明する最古コメントが作成されています（コメント＝Why 原則: 本文更新時に Why をコメントで残してください）`,
        rule: RULE,
        context: `#${item.number}`,
      },
    ];
  }

  return [];
}

/**
 * アイテムを取得してコメントファースト原則を検査する。
 */
export async function checkCommentFirst(
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
  return validateCommentFirst(item, severity);
}
