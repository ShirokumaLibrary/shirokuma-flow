/**
 * status approve - next_suggestions 生成ロジック
 *
 * Review ステータスの Issue を承認した後に推奨する次コマンドを返す純関数。
 *
 * 判定:
 * - 計画 Issue 承認（Review → Done）→ 親の実装フロー
 * - 設計 Issue 承認（Review → Done）→ 親の計画フロー or 実装フロー（両方）
 * - 課題 Issue トリアージ承認（Review → ToDo）→ 自身の実装フロー（着手を促す）
 *
 * plan / design は親 Issue 番号が前提のため、親番号が不明な独立 Issue では空配列を返す。
 * normal（課題トリアージ）は自身の Issue 番号で `/implement-flow #{number}` を提案する。
 *
 * @since #2683 normal（課題トリアージ）で自身番号の /implement-flow を提案（ADR-v3-022 改訂）
 */

export type IssueKind = "plan" | "design" | "normal";

export interface SuggestInput {
  issueKind: IssueKind;
  /** 承認対象 Issue 自身の番号（normal トリアージで /implement-flow #{number} 提案に使用） */
  number?: number;
  /** 親 Issue 番号（plan / design の次フロー提案に使用） */
  parentNumber?: number;
}

/**
 * 承認対象 Issue の種別と親情報から次に推奨するコマンド列を組み立てる。
 */
export function buildNextSuggestions(input: SuggestInput): string[] {
  const { issueKind, number, parentNumber } = input;

  switch (issueKind) {
    case "plan":
      if (!parentNumber) return [];
      return [`/implement-flow #${parentNumber}`];
    case "design":
      if (!parentNumber) return [];
      return [
        `/prepare-flow #${parentNumber}`,
        `/implement-flow #${parentNumber}`,
      ];
    case "normal":
      if (!number) return [];
      return [`/implement-flow #${number}`];
  }
}
