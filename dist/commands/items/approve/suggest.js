/**
 * items approve - next_suggestions 生成ロジック
 *
 * Review ステータスの Issue を承認した後に推奨する次コマンドを返す純関数。
 *
 * 判定:
 * - 計画 Issue 承認 → 親の実装フロー
 * - 設計 Issue 承認 → 親の計画フロー or 実装フロー（両方）
 * - 通常 Issue 承認 → 提案なし（Done 確定のみ）
 *
 * 親 Issue 番号が不明な場合（独立 Issue）は提案を生成できないため空配列を返す。
 */
/**
 * 承認対象 Issue の種別と親情報から次に推奨するコマンド列を組み立てる。
 */
export function buildNextSuggestions(input) {
    const { issueKind, parentNumber } = input;
    if (!parentNumber)
        return [];
    switch (issueKind) {
        case "plan":
            return [`/implement-flow #${parentNumber}`];
        case "design":
            return [
                `/prepare-flow #${parentNumber}`,
                `/implement-flow #${parentNumber}`,
            ];
        case "normal":
            return [];
    }
}
//# sourceMappingURL=suggest.js.map