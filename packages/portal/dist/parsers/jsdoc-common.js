/**
 * 共通 JSDoc パーサー
 *
 * 単行・複数行・リスト形式のタグを統一的に解析する。
 * shirokuma-flow 内の全コマンドで共通利用。
 *
 * @module parsers/jsdoc-common
 */
import { escapeRegExp } from "@shirokuma-library/lint";
import { findMatchingBrace } from "@shirokuma-library/lint/brace-matching";
import { camelToSnake } from "../utils/string-transforms.js";
// =============================================================================
// タグ設定
// =============================================================================
/**
 * タグの種類設定
 */
export const TAG_CONFIG = {
    /**
     * 単行タグ: 同じ行で終了
     * 形式: @tag value
     */
    singleLine: new Set([
        "dbTable",
        "feature",
        "layer",
        "module",
        "category",
        "inputSchema",
        "outputSchema",
        "authLevel",
        "rateLimit",
        "returns",
        "return",
        "type",
        "default",
        "since",
        "version",
        "deprecated",
        "see",
        "link",
        "author",
        "license",
    ]),
    /**
     * 複数行タグ: 次の@タグまで（プレーンテキスト）
     * 形式: @tag\n * line1\n * line2
     */
    multiLine: new Set(["description", "example", "remarks", "note"]),
    /**
     * リスト形式タグ: `- key: value` 形式
     * 形式: @tag\n *   - key: value (meta)
     */
    listFormat: new Set([
        "columns",
        "indexes",
        "relations",
        "usedInAction",
        "usedInScreen",
        "dbTables",
    ]),
    /**
     * エラーコード形式タグ: `- CODE: description (status)` 形式
     */
    errorCodeFormat: new Set(["errorCodes"]),
    /**
     * パラメータ形式タグ: `@param {type} name - description`
     */
    paramFormat: new Set(["param", "throws"]),
};
// =============================================================================
// メインパーサー
// =============================================================================
/**
 * JSDocブロックをパースする
 *
 * @param jsDocBlock - JSDocコメント文字列（/** ... *\/ 形式）
 * @returns パース結果
 *
 * @example
 * ```ts
 * const parsed = parseJsDoc(`/**
 *  * ユーザーテーブル
 *  *
 *  * ユーザー情報を管理します。
 *  *
 *  * @dbTable users
 *  * @feature UserManagement
 *  *\/`);
 *
 * console.log(parsed.description);
 * // => "ユーザーテーブル\n\nユーザー情報を管理します。"
 *
 * console.log(getTagValue(parsed, 'dbTable'));
 * // => "users"
 * ```
 */
export function parseJsDoc(jsDocBlock) {
    const raw = jsDocBlock;
    // Step 1: コメント記号を除去して正規化
    const lines = normalizeJsDocBlock(jsDocBlock);
    // Step 2: 説明文を抽出（最初の@タグまで）
    const { description, tagStartIndex } = extractDescription(lines);
    // Step 3: タグを抽出
    const tags = extractTags(lines, tagStartIndex);
    return { description, tags, raw };
}
/**
 * JSDocブロックを正規化して行配列に変換
 */
function normalizeJsDocBlock(jsDocBlock) {
    // /** と */ を除去
    const content = jsDocBlock
        .replace(/^\/\*\*\s*/, "")
        .replace(/\s*\*\/$/, "");
    // 行に分割
    const rawLines = content.split("\n");
    // 各行の先頭 * を除去（インデントは保持）
    return rawLines.map((line) => {
        // " * text" -> "text", "   * text" -> "text", "*" -> ""
        return line.replace(/^\s*\*\s?/, "");
    });
}
/**
 * 説明文を抽出（最初の@タグまで）
 *
 * @returns 説明文とタグ開始インデックス
 */
function extractDescription(lines) {
    const descLines = [];
    let tagStartIndex = lines.length;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        // @タグが出現したら終了
        if (trimmed.startsWith("@")) {
            tagStartIndex = i;
            break;
        }
        // 空行は段落区切りとして扱う
        if (trimmed === "") {
            // 既に説明文がある場合のみ空行を追加
            if (descLines.length > 0 && descLines[descLines.length - 1] !== "") {
                descLines.push("");
            }
            continue;
        }
        descLines.push(trimmed);
    }
    // 末尾の空行を除去し、連続空行を1つに
    const description = descLines
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    return { description, tagStartIndex };
}
/**
 * タグを抽出
 */
function extractTags(lines, startIndex) {
    const tags = new Map();
    let currentTag = null;
    let currentLines = [];
    // タグを処理する関数
    const processCurrentTag = () => {
        if (!currentTag)
            return;
        const tagName = currentTag;
        const tagContent = currentLines;
        // タグの種類に応じて値を生成
        const value = parseTagContent(tagName, tagContent);
        // 既存の値とマージ（同名タグの複数回出現に対応）
        if (tags.has(tagName)) {
            const existing = tags.get(tagName);
            if (Array.isArray(existing) && Array.isArray(value)) {
                tags.set(tagName, [...existing, ...value]);
            }
            // 単行タグの重複は上書き
            else {
                tags.set(tagName, value);
            }
        }
        else {
            tags.set(tagName, value);
        }
    };
    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        // 新しいタグの開始
        const tagMatch = trimmed.match(/^@(\w+)(?:\s+(.*))?$/);
        if (tagMatch) {
            // 前のタグを処理
            processCurrentTag();
            // 新しいタグを開始
            currentTag = tagMatch[1];
            currentLines = tagMatch[2] ? [tagMatch[2]] : [];
        }
        else if (currentTag) {
            // 継続行
            // インデントされた行または空行を追加
            currentLines.push(trimmed);
        }
    }
    // 最後のタグを処理
    processCurrentTag();
    return tags;
}
/**
 * タグの内容を種類に応じてパース
 */
function parseTagContent(tagName, lines) {
    // 単行タグ
    if (TAG_CONFIG.singleLine.has(tagName)) {
        return lines.join(" ").trim();
    }
    // パラメータ形式タグ
    if (TAG_CONFIG.paramFormat.has(tagName)) {
        return parseParamContent(lines);
    }
    // エラーコード形式タグ
    if (TAG_CONFIG.errorCodeFormat.has(tagName)) {
        return parseErrorCodeContent(lines);
    }
    // リスト形式タグ
    if (TAG_CONFIG.listFormat.has(tagName)) {
        return parseListContent(lines);
    }
    // 複数行タグ（デフォルト）
    return parseMultiLineContent(lines);
}
/**
 * 複数行タグの内容をパース
 */
function parseMultiLineContent(lines) {
    return lines
        .filter((line) => line !== "")
        .join("\n")
        .trim();
}
/**
 * リスト形式タグの内容をパース
 * 形式: `- key: value (meta)` または `- value`
 */
function parseListContent(lines) {
    const items = [];
    for (const line of lines) {
        // `- key: value (meta)` 形式
        const keyValueMatch = line.match(/^-\s+(\w+):\s*(.+?)(?:\s*\(([^)]+)\))?\s*$/);
        if (keyValueMatch) {
            items.push({
                key: keyValueMatch[1],
                value: keyValueMatch[2].trim(),
                meta: keyValueMatch[3]?.trim(),
            });
            continue;
        }
        // `- value` 形式（キーなし）
        const valueOnlyMatch = line.match(/^-\s+(.+)$/);
        if (valueOnlyMatch) {
            items.push({
                key: "",
                value: valueOnlyMatch[1].trim(),
            });
        }
    }
    return items;
}
/**
 * エラーコード形式タグの内容をパース
 * 形式: `- CODE: description (status)`
 */
function parseErrorCodeContent(lines) {
    const items = [];
    for (const line of lines) {
        // `- NOT_FOUND: エンティティが存在しない (404)` 形式
        const match = line.match(/^-\s+([A-Z_]+):\s*(.+?)\s*\((\d{3})\)\s*$/);
        if (match) {
            items.push({
                key: match[1],
                value: match[2].trim(),
                meta: match[3],
            });
        }
    }
    return items;
}
/**
 * パラメータ形式タグの内容をパース
 * 形式: `{type} name - description` または `name - description`
 */
function parseParamContent(lines) {
    const fullContent = lines.join(" ");
    // `{type} name - description` 形式
    const withTypeMatch = fullContent.match(/^\{([^}]+)\}\s+(\w+)\s*-?\s*(.*)$/);
    if (withTypeMatch) {
        return [
            {
                type: withTypeMatch[1].trim(),
                name: withTypeMatch[2],
                description: withTypeMatch[3].trim(),
            },
        ];
    }
    // `name - description` 形式
    const noTypeMatch = fullContent.match(/^(\w+)\s*-?\s*(.*)$/);
    if (noTypeMatch) {
        return [
            {
                name: noTypeMatch[1],
                description: noTypeMatch[2].trim(),
            },
        ];
    }
    return [];
}
// =============================================================================
// ヘルパー関数
// =============================================================================
/**
 * 単行タグの値を取得
 *
 * @param parsed - パース結果
 * @param tagName - タグ名（@なし）
 * @returns タグ値（存在しない場合は undefined）
 */
export function getTagValue(parsed, tagName) {
    const value = parsed.tags.get(tagName);
    if (typeof value === "string") {
        return value;
    }
    return undefined;
}
/**
 * 複数行タグの値を配列として取得
 *
 * @param parsed - パース結果
 * @param tagName - タグ名（@なし）
 * @returns 行配列（タグがない場合は空配列）
 */
export function getTagLines(parsed, tagName) {
    const value = parsed.tags.get(tagName);
    if (typeof value === "string") {
        return value.split("\n").filter((l) => l.trim());
    }
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
        return value;
    }
    return [];
}
/**
 * リスト形式タグの項目を取得
 *
 * @param parsed - パース結果
 * @param tagName - タグ名（@なし）
 * @returns リスト項目配列（タグがない場合は空配列）
 */
export function getTagItems(parsed, tagName) {
    const value = parsed.tags.get(tagName);
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && "key" in value[0]) {
        return value;
    }
    return [];
}
/**
 * パラメータ形式タグの項目を取得
 *
 * @param parsed - パース結果
 * @param tagName - タグ名（@なし、通常は "param" または "throws"）
 * @returns パラメータ項目配列（タグがない場合は空配列）
 */
export function getTagParams(parsed, tagName) {
    const value = parsed.tags.get(tagName);
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && "name" in value[0]) {
        return value;
    }
    return [];
}
/**
 * タグが存在するかチェック
 */
export function hasTag(parsed, tagName) {
    return parsed.tags.has(tagName);
}
/**
 * すべてのタグ名を取得
 */
export function getTagNames(parsed) {
    return Array.from(parsed.tags.keys());
}
// =============================================================================
// ソースコードからの抽出
// =============================================================================
/**
 * ファイルヘッダーのJSDocを抽出
 *
 * ファイル先頭にある最初のJSDocブロックを抽出する。
 * page.tsx など、ファイル全体が1つの画面/コンポーネントを表す場合に使用。
 *
 * @param sourceCode - ソースコード全体
 * @returns JSDocブロック（見つからない場合は空文字列）
 */
export function extractFileHeaderJsDoc(sourceCode) {
    // ファイル先頭のJSDocを探す（import文より前）
    const jsDocMatch = sourceCode.match(/^\s*(\/\*\*[\s\S]*?\*\/)/);
    if (jsDocMatch) {
        return jsDocMatch[1];
    }
    return "";
}
/**
 * JSDocブロック内の@screenまたは@componentタグの値を取得
 *
 * @param jsDocBlock - JSDocブロック
 * @returns @screenまたは@componentの値（見つからない場合はundefined）
 */
function getScreenOrComponentName(jsDocBlock) {
    // \S+ を使用して括弧を含む名前にもマッチ: (dashboard)SettingsScreen など
    const screenMatch = jsDocBlock.match(/@screen\s+(\S+)/);
    if (screenMatch)
        return screenMatch[1];
    const componentMatch = jsDocBlock.match(/@component\s+(\S+)/);
    if (componentMatch)
        return componentMatch[1];
    return undefined;
}
/**
 * ソースコードから指定された名前の直前にあるJSDocを抽出
 *
 * @param sourceCode - ソースコード全体
 * @param targetName - 対象の関数/変数名、または@screen/@componentの値
 * @returns JSDocブロック（見つからない場合は空文字列）
 */
export function extractJsDocBefore(sourceCode, targetName) {
    // 対象の定義パターン（export const name = ... または export function name）
    const patterns = [
        new RegExp(`export\\s+const\\s+${escapeRegExp(targetName)}\\s*=`),
        new RegExp(`export\\s+(?:async\\s+)?function\\s+${escapeRegExp(targetName)}\\s*[<(]`),
        new RegExp(`const\\s+${escapeRegExp(targetName)}\\s*=`),
        new RegExp(`(?:async\\s+)?function\\s+${escapeRegExp(targetName)}\\s*[<(]`),
    ];
    for (const pattern of patterns) {
        const match = pattern.exec(sourceCode);
        if (!match)
            continue;
        const defStart = match.index;
        const beforeDef = sourceCode.substring(0, defStart);
        // 直前のJSDocを探す
        const jsDocEnd = beforeDef.lastIndexOf("*/");
        if (jsDocEnd === -1)
            continue;
        // */ と定義の間に他のコードがないか確認
        const between = beforeDef.substring(jsDocEnd + 2);
        if (!/^\s*$/.test(between))
            continue;
        // /** を探す
        const jsDocStart = beforeDef.lastIndexOf("/**");
        if (jsDocStart === -1 || jsDocStart > jsDocEnd)
            continue;
        return beforeDef.substring(jsDocStart, jsDocEnd + 2);
    }
    // フォールバック: ファイルヘッダーJSDocをチェック
    // @screen または @component タグの値が targetName と一致する場合、
    // ファイルヘッダーのJSDocを返す（page.tsx などで使用）
    const headerJsDoc = extractFileHeaderJsDoc(sourceCode);
    if (headerJsDoc) {
        const headerName = getScreenOrComponentName(headerJsDoc);
        if (headerName === targetName) {
            return headerJsDoc;
        }
    }
    return "";
}
/**
 * ソースコードからすべてのJSDocを抽出
 *
 * @param sourceCode - ソースコード全体
 * @returns 名前とJSDocのペア配列
 */
export function extractAllJsDocs(sourceCode) {
    const results = [];
    // export function または export const を検出
    const patterns = [
        /(?<jsdoc>\/\*\*[\s\S]*?\*\/)\s*export\s+(?:async\s+)?function\s+(?<name>\w+)\s*[<(]/g,
        /(?<jsdoc>\/\*\*[\s\S]*?\*\/)\s*export\s+const\s+(?<name>\w+)\s*=/g,
    ];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(sourceCode)) !== null) {
            const jsDoc = match.groups?.jsdoc;
            const name = match.groups?.name;
            if (jsDoc && name) {
                results.push({
                    name,
                    jsDoc,
                    parsed: parseJsDoc(jsDoc),
                });
            }
        }
    }
    return results;
}
/**
 * Drizzle ORMスキーマファイルからJSDoc情報を抽出
 *
 * @param sourceCode - スキーマファイルの内容
 * @returns DBスキーマJSDoc情報
 */
export function extractDbSchemaJsDocs(sourceCode) {
    const result = {
        tables: new Map(),
        columns: new Map(),
        indexes: new Map(),
        parsed: new Map(),
    };
    // pgTable定義を検出
    // パターン: export const ... = pgTable("table_name" or \n  "table_name"
    const pgTableDefRegex = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*\n?\s*["'](\w+)["']/g;
    let defMatch;
    while ((defMatch = pgTableDefRegex.exec(sourceCode)) !== null) {
        const tableName = defMatch[2]; // SQLテーブル名
        const defStart = defMatch.index;
        // 定義の直前にあるJSDocを探す
        const beforeDef = sourceCode.substring(0, defStart);
        const jsDocEnd = beforeDef.lastIndexOf("*/");
        if (jsDocEnd === -1)
            continue;
        // */ と export の間に他のコードがないか確認
        const between = beforeDef.substring(jsDocEnd + 2);
        if (!/^\s*$/.test(between))
            continue;
        // /** を探す
        const jsDocStart = beforeDef.lastIndexOf("/**");
        if (jsDocStart === -1 || jsDocStart > jsDocEnd)
            continue;
        // JSDocをパース
        const jsDocBlock = beforeDef.substring(jsDocStart, jsDocEnd + 2);
        const parsed = parseJsDoc(jsDocBlock);
        // テーブル説明を保存
        if (parsed.description) {
            result.tables.set(tableName, parsed.description);
        }
        result.parsed.set(tableName, parsed);
        // カラムとインデックスのJSDocを抽出
        const { columns: columnMap, indexes: indexMap } = extractTableJsDocs(sourceCode, defMatch.index);
        if (columnMap.size > 0) {
            result.columns.set(tableName, columnMap);
        }
        if (indexMap.size > 0) {
            result.indexes.set(tableName, indexMap);
        }
    }
    return result;
}
/**
 * pgTable定義内のカラムとインデックスのJSDocを抽出
 */
function extractTableJsDocs(sourceCode, tableDefStart) {
    const columns = new Map();
    const indexes = new Map();
    // pgTableの内容を抽出
    // pgTable("name", { ... }, (table) => [...])
    // または pgTable("name", { ... })
    // 開始位置から { を探す
    const openBraceIndex = sourceCode.indexOf("{", tableDefStart);
    if (openBraceIndex === -1)
        return { columns, indexes };
    // 対応する } を探す（文字列・コメント考慮）
    const closeBraceIndex = findMatchingBrace(sourceCode, openBraceIndex);
    if (closeBraceIndex === null)
        return { columns, indexes };
    const tableContent = sourceCode.substring(openBraceIndex + 1, closeBraceIndex);
    // カラム定義: /** comment */ name: type(...) または /** comment */ name,
    const columnRegex = /\/\*\*\s*([^*]*(?:\*(?!\/)[^*]*)*)\s*\*\/\s*(\w+)\s*[,:]/g;
    let colMatch;
    while ((colMatch = columnRegex.exec(tableContent)) !== null) {
        const comment = colMatch[1].replace(/\s*\n\s*\*?\s*/g, " ").trim();
        const columnName = colMatch[2];
        // id カラムは除外（共通定義のため）
        if (comment && columnName !== "id") {
            // キャメルケースをスネークケースに変換（userId -> user_id）
            const snakeCaseName = camelToSnake(columnName);
            columns.set(snakeCaseName, comment);
        }
    }
    // インデックス定義を抽出: (table) => [...] の部分
    // } の後ろから ); までを検索
    const afterColumns = sourceCode.substring(closeBraceIndex + 1);
    const indexBlockMatch = afterColumns.match(/^\s*,\s*\(\s*\w*\s*\)\s*=>\s*\[([\s\S]*?)\]\s*\)/);
    if (indexBlockMatch) {
        const indexContent = indexBlockMatch[1];
        // インデックス定義: /** comment */ uniqueIndex("name") または index("name")
        const indexRegex = /\/\*\*\s*([^*]*(?:\*(?!\/)[^*]*)*)\s*\*\/\s*(?:uniqueIndex|index)\s*\(\s*["']([^"']+)["']\)/g;
        let idxMatch;
        while ((idxMatch = indexRegex.exec(indexContent)) !== null) {
            const comment = idxMatch[1].replace(/\s*\n\s*\*?\s*/g, " ").trim();
            const indexName = idxMatch[2];
            if (comment && indexName) {
                indexes.set(indexName, comment);
            }
        }
    }
    return { columns, indexes };
}
// =============================================================================
// コンポーネント名自動検出
// =============================================================================
/**
 * ファイル内容から export されたコンポーネント名を抽出
 *
 * 以下のパターンを検出:
 * - export function ComponentName
 * - export default function ComponentName
 * - export const ComponentName = ...
 * - export default ComponentName (at end of file)
 *
 * PascalCase の名前のみをコンポーネントとして扱う
 *
 * @param content - ファイル内容
 * @returns 検出されたコンポーネント名（PascalCaseのもののみ）
 */
export function extractExportedComponentName(content) {
    // PascalCase判定（大文字で始まる）
    const isPascalCase = (name) => /^[A-Z][a-zA-Z0-9]*$/.test(name);
    // 1. export function ComponentName または export async function ComponentName
    const exportFuncMatch = content.match(/export\s+(?:async\s+)?function\s+([A-Z][a-zA-Z0-9]*)\s*[(<]/);
    if (exportFuncMatch && isPascalCase(exportFuncMatch[1])) {
        return exportFuncMatch[1];
    }
    // 2. export default function ComponentName
    const exportDefaultFuncMatch = content.match(/export\s+default\s+(?:async\s+)?function\s+([A-Z][a-zA-Z0-9]*)\s*[(<]/);
    if (exportDefaultFuncMatch && isPascalCase(exportDefaultFuncMatch[1])) {
        return exportDefaultFuncMatch[1];
    }
    // 3. export const ComponentName = (arrow function or forwardRef)
    const exportConstMatch = content.match(/export\s+const\s+([A-Z][a-zA-Z0-9]*)\s*[=:]/);
    if (exportConstMatch && isPascalCase(exportConstMatch[1])) {
        return exportConstMatch[1];
    }
    // 4. ファイル名からフォールバック（- を PascalCase に変換）
    // この関数は content のみ受け取るため、呼び出し元でファイル名からの推論を行う
    return undefined;
}
//# sourceMappingURL=jsdoc-common.js.map