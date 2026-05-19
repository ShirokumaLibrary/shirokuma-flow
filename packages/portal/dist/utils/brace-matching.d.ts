/**
 * 波括弧マッチングユーティリティ
 *
 * 文字列リテラル・コメント内の波括弧を無視して
 * 正確な波括弧マッチングを提供する。
 */
/**
 * 開き波括弧に対応する閉じ波括弧のインデックスを返す。
 * 文字列リテラル（"、'、`）、行コメント（//）、ブロックコメントを無視する。
 *
 * @param source - ソースコード
 * @param openBraceIndex - 開き波括弧 '{' の位置
 * @returns 閉じ波括弧のインデックス。見つからない場合は null
 */
export declare function findMatchingBrace(source: string, openBraceIndex: number): number | null;
/**
 * 行内の波括弧バランスを計算する。
 * { は +1、} は -1 として合計を返す。
 * 文字列リテラル（"、'、`）と行コメント（//）内の波括弧は無視する。
 *
 * ブロックコメントは行をまたぐ状態管理が必要なため対象外。
 *
 * @param line - 1行のテキスト
 * @returns 波括弧の depth 増減値
 */
export declare function countBraces(line: string): number;
//# sourceMappingURL=brace-matching.d.ts.map