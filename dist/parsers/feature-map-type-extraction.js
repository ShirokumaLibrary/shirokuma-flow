/**
 * feature-map 型・ユーティリティ抽出
 *
 * TypeScript ソースコードからエクスポートされた型定義
 * （interface, type, enum）とユーティリティ（定数, 関数）を抽出する。
 */
import { extractDescription } from "./feature-map-utils.js";
import { findMatchingBrace } from "../utils/brace-matching.js";
/**
 * エクスポートされた型定義を抽出
 */
export function extractExportedTypes(content) {
    const types = [];
    // export interface パターン（ブレースマッチングで本体を抽出）
    const interfaceStartRegex = /export\s+interface\s+(\w+)\s*\{/g;
    for (const match of content.matchAll(interfaceStartRegex)) {
        const name = match[1];
        const startIndex = match.index;
        const braceStart = startIndex + match[0].length - 1; // '{' の位置
        // ブレースマッチングで本体を抽出
        const closingBrace = findMatchingBrace(content, braceStart);
        if (closingBrace === null)
            continue;
        const fullMatch = content.slice(braceStart, closingBrace + 1);
        const body = content.slice(braceStart + 1, closingBrace);
        const matchText = match[0].slice(0, -1) + fullMatch; // 完全なマッチテキスト
        // 直前のJSDocを抽出
        const { jsdoc, sourceCode } = extractPrecedingJSDoc(content, startIndex, matchText);
        const description = jsdoc ? extractDescription(jsdoc) : undefined;
        const fields = extractInterfaceFields(body);
        types.push({
            name,
            kind: "interface",
            description,
            fields,
            sourceCode,
        });
    }
    // export type パターン (オブジェクト型) - ブレースマッチング
    const typeObjectStartRegex = /export\s+type\s+(\w+)\s*=\s*\{/g;
    for (const match of content.matchAll(typeObjectStartRegex)) {
        const name = match[1];
        const startIndex = match.index;
        const braceStart = startIndex + match[0].length - 1; // '{' の位置
        const closingBrace = findMatchingBrace(content, braceStart);
        if (closingBrace === null)
            continue;
        const fullMatch = content.slice(braceStart, closingBrace + 1);
        const body = content.slice(braceStart + 1, closingBrace);
        const matchText = match[0].slice(0, -1) + fullMatch;
        const { jsdoc, sourceCode } = extractPrecedingJSDoc(content, startIndex, matchText);
        const description = jsdoc ? extractDescription(jsdoc) : undefined;
        const fields = extractInterfaceFields(body);
        types.push({
            name,
            kind: "type",
            description,
            fields,
            sourceCode,
        });
    }
    // export type パターン (ユニオン/その他)
    const typeSimpleRegex = /export\s+type\s+(\w+)\s*=\s*([^;{]+);/g;
    for (const match of content.matchAll(typeSimpleRegex)) {
        const name = match[1];
        // 既にオブジェクト型として追加されているかチェック
        if (types.some(t => t.name === name))
            continue;
        const { jsdoc, sourceCode } = extractPrecedingJSDoc(content, match.index, match[0]);
        const description = jsdoc ? extractDescription(jsdoc) : undefined;
        types.push({
            name,
            kind: "type",
            description,
            sourceCode,
        });
    }
    // export enum パターン - ブレースマッチング
    const enumStartRegex = /export\s+enum\s+(\w+)\s*\{/g;
    for (const match of content.matchAll(enumStartRegex)) {
        const name = match[1];
        const startIndex = match.index;
        const braceStart = startIndex + match[0].length - 1;
        const closingBrace = findMatchingBrace(content, braceStart);
        if (closingBrace === null)
            continue;
        const fullMatch = content.slice(braceStart, closingBrace + 1);
        const body = content.slice(braceStart + 1, closingBrace);
        const matchText = match[0].slice(0, -1) + fullMatch;
        const { jsdoc, sourceCode } = extractPrecedingJSDoc(content, startIndex, matchText);
        const description = jsdoc ? extractDescription(jsdoc) : undefined;
        const values = extractEnumValues(body);
        types.push({
            name,
            kind: "enum",
            description,
            values,
            sourceCode,
        });
    }
    return types;
}
/**
 * ブレースで囲まれたブロックを抽出（ネスト対応）
 *
 * @param content - ソースコード全体
 * @param startIndex - 開始ブレース '{' の位置
 * @returns ブレース含む完全なブロック、または null
 */
export function extractBracedBlock(content, startIndex) {
    const closingBrace = findMatchingBrace(content, startIndex);
    if (closingBrace === null)
        return null;
    return content.slice(startIndex, closingBrace + 1);
}
/**
 * 直前のJSDocコメントを抽出
 *
 * @description 宣言の直前（空白のみ許容）にあるJSDocコメントを検出し、
 * JSDocとソースコードを結合して返す。
 * ファイルヘッダーやインポート文の後のJSDocは除外する。
 */
export function extractPrecedingJSDoc(content, matchIndex, matchText) {
    // マッチ位置より前の内容を取得
    const beforeMatch = content.slice(0, matchIndex);
    // 末尾から見て、直前の */ を探す（空白のみ許容）
    const jsdocEndPattern = /\*\/\s*$/;
    const jsdocEndMatch = beforeMatch.match(jsdocEndPattern);
    if (!jsdocEndMatch) {
        // JSDocが直前にない
        return { jsdoc: null, sourceCode: matchText.trim() };
    }
    // 最後の */ の位置を特定
    const lastJsdocEnd = beforeMatch.lastIndexOf("*/");
    if (lastJsdocEnd === -1) {
        return { jsdoc: null, sourceCode: matchText.trim() };
    }
    // */ の位置から、その後に空白以外がないか確認
    const afterJsdocEnd = beforeMatch.slice(lastJsdocEnd + 2);
    if (!/^\s*$/.test(afterJsdocEnd)) {
        // JSDocと宣言の間にコードがある
        return { jsdoc: null, sourceCode: matchText.trim() };
    }
    // この */ に対応する /** を探す（逆方向に検索）
    const searchArea = beforeMatch.slice(0, lastJsdocEnd);
    let jsdocStart = -1;
    // 逆方向にスキャンして対応する /** を探す
    for (let i = searchArea.length - 1; i >= 2; i--) {
        if (searchArea.slice(i - 2, i + 1) === "/**") {
            jsdocStart = i - 2;
            break;
        }
    }
    if (jsdocStart === -1) {
        return { jsdoc: null, sourceCode: matchText.trim() };
    }
    const jsdoc = beforeMatch.slice(jsdocStart, lastJsdocEnd + 2);
    const sourceCode = (jsdoc + "\n" + matchText).trim();
    return { jsdoc, sourceCode };
}
/**
 * インターフェースのフィールドを抽出
 */
export function extractInterfaceFields(body) {
    const fields = [];
    const lines = body.split("\n");
    let currentDescription;
    for (const line of lines) {
        const trimmed = line.trim();
        // JSDocコメントから説明を抽出
        const docMatch = trimmed.match(/\/\*\*\s*(.+?)\s*\*\//);
        if (docMatch) {
            currentDescription = docMatch[1];
            continue;
        }
        // 単行コメント
        if (trimmed.startsWith("//")) {
            currentDescription = trimmed.slice(2).trim();
            continue;
        }
        // フィールド定義
        const fieldMatch = trimmed.match(/^(\w+)\??\s*:\s*(.+?);?\s*$/);
        if (fieldMatch) {
            fields.push({
                name: fieldMatch[1],
                type: fieldMatch[2].replace(/;$/, "").trim(),
                description: currentDescription,
            });
            currentDescription = undefined;
        }
    }
    return fields;
}
/**
 * enumの値を抽出
 */
export function extractEnumValues(body) {
    const values = [];
    const lines = body.split(",");
    for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(/^(\w+)/);
        if (match) {
            values.push(match[1]);
        }
    }
    return values;
}
/**
 * エクスポートされたユーティリティ（定数・ヘルパー関数）を抽出
 *
 * @description
 * - export const NAME = ... 形式の定数
 * - export function name(...) 形式の関数（@serverAction タグがないもの）
 * を抽出する。
 *
 * @param content - ファイル内容
 * @returns ユーティリティアイテムの配列
 */
export function extractExportedUtilities(content) {
    const utilities = [];
    // export const パターン
    const constRegex = /(?:\/\*\*[\s\S]*?\*\/\s*)?export\s+const\s+(\w+)(?:\s*:\s*([^=]+?))?\s*=\s*([^;\n]+)/g;
    for (const match of content.matchAll(constRegex)) {
        const name = match[1];
        const typeAnnotation = match[2]?.trim();
        const value = match[3]?.trim();
        // 関数（アロー関数）は除外
        if (value.startsWith("(") || value.startsWith("async (") || value.includes("=>")) {
            continue;
        }
        const jsdocMatch = match[0].match(/\/\*\*[\s\S]*?\*\//);
        const description = jsdocMatch ? extractDescription(jsdocMatch[0]) : undefined;
        utilities.push({
            name,
            kind: "constant",
            description,
            type: typeAnnotation,
            value: value.length > 50 ? value.substring(0, 50) + "..." : value,
        });
    }
    // export function パターン（@serverAction がないもの）
    const functionRegex = /(\/\*\*[\s\S]*?\*\/)\s*export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+?))?\s*\{/g;
    for (const match of content.matchAll(functionRegex)) {
        const jsdocBlock = match[1];
        // @serverAction タグがある場合はスキップ
        if (jsdocBlock && jsdocBlock.includes("@serverAction")) {
            continue;
        }
        const name = match[2];
        const paramsStr = match[3];
        const returnType = match[4]?.trim();
        const description = jsdocBlock ? extractDescription(jsdocBlock) : undefined;
        const params = parseParams(paramsStr);
        utilities.push({
            name,
            kind: "function",
            description,
            type: returnType,
            params,
        });
    }
    return utilities;
}
/**
 * 関数の引数文字列をパースする
 */
export function parseParams(paramsStr) {
    if (!paramsStr.trim())
        return [];
    const params = [];
    const parts = paramsStr.split(",");
    for (const part of parts) {
        const trimmed = part.trim();
        // name: Type または name?: Type
        const match = trimmed.match(/^(\w+)\??\s*:\s*(.+)$/);
        if (match) {
            params.push({
                name: match[1],
                type: match[2].trim(),
            });
        }
        else if (trimmed) {
            const nameMatch = trimmed.match(/^(\w+)/);
            if (nameMatch) {
                params.push({
                    name: nameMatch[1],
                    type: "unknown",
                });
            }
        }
    }
    return params;
}
//# sourceMappingURL=feature-map-type-extraction.js.map