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
export function findMatchingBrace(source, openBraceIndex) {
    if (source[openBraceIndex] !== "{")
        return null;
    let depth = 0;
    let inString = false;
    let stringChar = "";
    let inComment = false;
    let commentType = null;
    for (let i = openBraceIndex; i < source.length; i++) {
        const char = source[i];
        const nextChar = source[i + 1] || "";
        const prevChar = i > 0 ? source[i - 1] : "";
        // コメント開始の検出
        if (!inString && !inComment) {
            if (char === "/" && nextChar === "/") {
                inComment = true;
                commentType = "line";
                continue;
            }
            if (char === "/" && nextChar === "*") {
                inComment = true;
                commentType = "block";
                continue;
            }
        }
        // コメント終了の検出
        if (inComment) {
            if (commentType === "line" && char === "\n") {
                inComment = false;
                commentType = null;
            }
            else if (commentType === "block" && prevChar === "*" && char === "/") {
                inComment = false;
                commentType = null;
            }
            continue;
        }
        // 文字列開始の検出
        if (!inString && (char === '"' || char === "'" || char === "`")) {
            inString = true;
            stringChar = char;
            continue;
        }
        // 文字列終了の検出
        if (inString) {
            if (char === stringChar && prevChar !== "\\") {
                inString = false;
                stringChar = "";
            }
            continue;
        }
        // 波括弧カウント
        if (char === "{") {
            depth++;
        }
        else if (char === "}") {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return null;
}
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
export function countBraces(line) {
    let count = 0;
    let inString = false;
    let stringChar = "";
    let escaped = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === "\\") {
            escaped = true;
            continue;
        }
        // 行コメント検出: 残りを無視
        if (!inString && char === "/" && line[i + 1] === "/") {
            break;
        }
        if (!inString && (char === '"' || char === "'" || char === "`")) {
            inString = true;
            stringChar = char;
        }
        else if (inString && char === stringChar) {
            inString = false;
        }
        else if (!inString) {
            if (char === "{")
                count++;
            else if (char === "}")
                count--;
        }
    }
    return count;
}
//# sourceMappingURL=brace-matching.js.map