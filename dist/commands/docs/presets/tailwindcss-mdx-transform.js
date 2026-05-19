/**
 * Tailwind CSS MDX → Markdown 変換
 *
 * tailwindcss.com の .mdx ファイルを LLM が読める純粋な Markdown に変換する。
 * JSX コンポーネントを静的にテキスト変換する（JS 実行は行わない）。
 *
 * 対応パターン:
 * - import 文の除去
 * - export const title/description → H1 + 説明段落
 * - <ApiTable rows={[...]} /> → Markdown テーブル
 * - <Figure>, <Example> → ラッパー除去（中の Markdown/コードは保持）
 * - content.tsx コンポーネント → 定型テキストに置換
 * - その他の自己閉じ JSX タグ → 除去
 */
// =============================================================================
// Main
// =============================================================================
export function transformMdxToMd(content) {
    let result = content;
    // 1. title / description を抽出
    const title = extractExportConst(result, "title");
    const description = extractExportConst(result, "description");
    // 2. import 文と export const を除去
    result = removeImports(result);
    result = removeExportConsts(result);
    // 3. ApiTable → Markdown テーブル
    result = transformApiTables(result);
    // 4. content.tsx の定型コンポーネント → テキスト置換
    result = transformContentComponents(result);
    // 5. JSX ラッパータグを除去（Figure, Example, Stripes, CodeExampleStack 等）
    result = removeJsxWrappers(result);
    // 6. 残った自己閉じ JSX タグを除去
    result = removeSelfClosingJsx(result);
    // 7. JSX 式コンテナ（{...}で囲まれた JSX コード例）をコードブロックに
    result = transformJsxExpressions(result);
    // 8. title / description をヘッダーとして挿入
    const header = buildHeader(title, description);
    // 9. 空行の正規化（3行以上の連続空行を2行に）
    result = result.replace(/\n{3,}/g, "\n\n");
    result = result.trim();
    return header + result + "\n";
}
// =============================================================================
// Export Const 抽出
// =============================================================================
function extractExportConst(content, name) {
    // 単一行: export const title = "...";
    const singleLine = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*"([^"]*)"\\s*;`);
    const m1 = content.match(singleLine);
    if (m1)
        return m1[1];
    // 複数行: export const description =\n  "...";
    const multiLine = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\n\\s*"([^"]*)"\\s*;`);
    const m2 = content.match(multiLine);
    if (m2)
        return m2[1];
    return null;
}
function buildHeader(title, description) {
    let header = "";
    // フロントマター
    if (title || description) {
        header += "---\n";
        if (title)
            header += `title: "${title}"\n`;
        if (description)
            header += `description: "${description}"\n`;
        header += "---\n\n";
    }
    return header;
}
// =============================================================================
// Import / Export 除去
// =============================================================================
function removeImports(content) {
    // 単一行 import
    let result = content.replace(/^import\s+.*;\s*$/gm, "");
    // 複数行 import（import { ... \n ... } from "..."）
    result = result.replace(/^import\s+\{[^}]*\}\s+from\s+"[^"]*"\s*;?\s*$/gm, "");
    // 残りの import（from 行が次行にある場合）
    result = result.replace(/^import\s+[\s\S]*?from\s+"[^"]*"\s*;?\s*$/gm, "");
    return result;
}
function removeExportConsts(content) {
    // 単一行
    let result = content.replace(/^export\s+const\s+\w+\s*=\s*"[^"]*"\s*;\s*$/gm, "");
    // 複数行
    result = result.replace(/^export\s+const\s+\w+\s*=\s*\n\s*"[^"]*"\s*;\s*$/gm, "");
    return result;
}
// =============================================================================
// ApiTable 変換
// =============================================================================
function transformApiTables(content) {
    // <ApiTable\n  rows={[...]}  /> のブロック全体を検出
    // 複数行にまたがる JSX ブロックをマッチ
    return content.replace(/<ApiTable\s[\s\S]*?\/>/g, (match) => parseApiTableToMarkdown(match));
}
function parseApiTableToMarkdown(block) {
    // rows={[ の開始を探す
    const rowsStart = block.indexOf("rows={[");
    if (rowsStart === -1)
        return "";
    // rows の中身を抽出（ブラケットのネストを追跡）
    const contentStart = rowsStart + "rows={".length;
    const arrayContent = extractBalancedBrackets(block, contentStart);
    if (!arrayContent)
        return "";
    // 行データをパース
    const rows = parseArrayRows(arrayContent);
    if (rows.length === 0)
        return "";
    // Markdown テーブルに変換
    return buildMarkdownTable(["Class", "Styles"], rows);
}
/**
 * ブラケットのネストを追跡して対応する閉じブラケットまでの文字列を抽出
 */
function extractBalancedBrackets(text, start) {
    if (text[start] !== "[")
        return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (ch === "[")
            depth++;
        else if (ch === "]") {
            depth--;
            if (depth === 0) {
                return text.slice(start, i + 1);
            }
        }
    }
    return null;
}
/**
 * 外側の配列から各行（内側の配列）を抽出
 * 文字列リテラルのみの行をパースし、複雑な式（spread, .map 等）はスキップ
 */
function parseArrayRows(arrayStr) {
    const rows = [];
    // 外側の [ ] を除去
    const inner = arrayStr.slice(1, -1).trim();
    // 各行の配列 [...] を検出
    let i = 0;
    while (i < inner.length) {
        // spread operator や複雑な式はスキップ
        if (inner[i] === "." && inner.slice(i, i + 3) === "...") {
            // 次の ] まで or 次の [ までスキップ
            const nextBracket = inner.indexOf("[", i);
            if (nextBracket === -1)
                break;
            // このspread式の終わりを見つける（対応する閉じパレン/ブラケット）
            i = skipExpression(inner, i);
            continue;
        }
        if (inner[i] === "[") {
            const rowContent = extractBalancedBrackets(inner, i);
            if (rowContent) {
                const parsed = parseRowCells(rowContent);
                if (parsed) {
                    rows.push(parsed);
                }
                i += rowContent.length;
            }
            else {
                i++;
            }
        }
        else {
            i++;
        }
    }
    return rows;
}
/**
 * 複雑な式（...Object.entries().map()等）をスキップ
 */
function skipExpression(text, start) {
    let depth = 0;
    let i = start;
    // パレンとブラケットのネストを追跡
    while (i < text.length) {
        const ch = text[i];
        if (ch === "(" || ch === "[")
            depth++;
        else if (ch === ")" || ch === "]") {
            depth--;
            if (depth < 0)
                return i;
        }
        // トップレベルのカンマに到達したら式の終わり
        if (depth === 0 && ch === ",")
            return i + 1;
        i++;
    }
    return i;
}
/**
 * 行配列 ["class", "style"] からセル文字列を抽出
 * 文字列リテラルのみ対応、テンプレートリテラルや dedent は簡易変換
 */
function parseRowCells(rowStr) {
    const inner = rowStr.slice(1, -1).trim();
    const cells = [];
    let i = 0;
    while (i < inner.length) {
        const ch = inner[i];
        if (ch === '"' || ch === "'") {
            // クォート文字列
            const str = extractQuotedString(inner, i);
            if (str !== null) {
                cells.push(str.value);
                i = str.end;
            }
            else {
                return null;
            }
        }
        else if (ch === "`") {
            // テンプレートリテラル
            const str = extractTemplateLiteral(inner, i);
            if (str !== null) {
                cells.push(str.value.trim());
                i = str.end;
            }
            else {
                return null;
            }
        }
        else if (inner.slice(i).startsWith("dedent`")) {
            // dedent`...`
            const str = extractTemplateLiteral(inner, i + "dedent".length);
            if (str !== null) {
                cells.push(dedentString(str.value).trim());
                i = str.end;
            }
            else {
                return null;
            }
        }
        else if (ch === "," || ch === " " || ch === "\n" || ch === "\r" || ch === "\t") {
            i++;
        }
        else {
            // 未知の式 → この行はスキップ
            return null;
        }
    }
    return cells.length >= 2 ? cells : null;
}
function extractQuotedString(text, start) {
    const quote = text[start];
    let i = start + 1;
    let value = "";
    while (i < text.length) {
        if (text[i] === "\\" && i + 1 < text.length) {
            value += text[i + 1];
            i += 2;
        }
        else if (text[i] === quote) {
            return { value, end: i + 1 };
        }
        else {
            value += text[i];
            i++;
        }
    }
    return null;
}
function extractTemplateLiteral(text, start) {
    if (text[start] !== "`")
        return null;
    let i = start + 1;
    let value = "";
    while (i < text.length) {
        if (text[i] === "\\" && i + 1 < text.length) {
            value += text[i + 1];
            i += 2;
        }
        else if (text[i] === "`") {
            return { value, end: i + 1 };
        }
        else {
            value += text[i];
            i++;
        }
    }
    return null;
}
/**
 * JSX 要素の終了行インデックスを返す。
 * 自己閉じタグ (/>) または対応する閉じタグ (</tag>) を検出。
 */
function findJsxElementEnd(lines, start) {
    const startTrimmed = lines[start].trim();
    // 単一行で自己閉じ
    if (/\/>\s*$/.test(startTrimmed))
        return start;
    // タグ名を抽出
    const tagMatch = startTrimmed.match(/^<([a-z][\w-]*)/);
    const tagName = tagMatch?.[1];
    // 開きタグが > で閉じている場合、対応する </tag> を探す
    // 開きタグがまだ閉じていない場合、/> か > を探す
    for (let j = start + 1; j < lines.length && j < start + 50; j++) {
        const lt = lines[j].trim();
        // 自己閉じ
        if (/\/>\s*$/.test(lt))
            return j;
        // 対応する閉じタグ
        if (tagName && lt === `</${tagName}>`)
            return j;
        // > で開きタグが閉じた後、内容を含んで閉じタグ
        if (tagName && new RegExp(`</${tagName}>`).test(lt))
            return j;
    }
    // 閉じが見つからない場合は開始行のみ
    return start;
}
/**
 * dedent 相当の処理: 共通インデントを除去
 */
function dedentString(str) {
    const lines = str.split("\n");
    // 先頭・末尾の空行を除去
    while (lines.length > 0 && lines[0].trim() === "")
        lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === "")
        lines.pop();
    // 最小インデントを検出
    const minIndent = lines
        .filter((l) => l.trim() !== "")
        .reduce((min, line) => {
        const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
        return Math.min(min, indent);
    }, Infinity);
    if (minIndent === Infinity || minIndent === 0)
        return lines.join("\n");
    return lines.map((l) => l.slice(minIndent)).join("\n");
}
function buildMarkdownTable(headers, rows) {
    // セル内の改行をスペースに、パイプをエスケープ
    const escapeCell = (s) => s.replace(/\n/g, " ").replace(/\|/g, "\\|").trim();
    const headerLine = `| ${headers.map(escapeCell).join(" | ")} |`;
    const separator = `| ${headers.map(() => "---").join(" | ")} |`;
    const dataLines = rows.map((row) => `| ${row.slice(0, headers.length).map(escapeCell).join(" | ")} |`);
    return [headerLine, separator, ...dataLines].join("\n") + "\n";
}
// =============================================================================
// Content コンポーネント置換
// =============================================================================
/** content.tsx の定型コンポーネントを説明テキストに置換 */
function transformContentComponents(content) {
    let result = content;
    // 定型コンポーネントを除去（全ユーティリティページ共通の定型文でありノイズ）
    const boilerplatePatterns = [
        /<ResponsiveDesign[\s\S]*?\/>/g,
        /<ResponsiveDesign[\s\S]*?>/g,
        /<\/ResponsiveDesign>/g,
        /<UsingACustomValue[\s\S]*?\/>/g,
        /<CustomizingYourThemeColors[\s\S]*?\/>/g,
        /<CustomizingYourTheme(?!Colors)[\s\S]*?\/>/g,
        /<CustomizingYourTheme(?!Colors)[\s\S]*?>/g,
        /<\/CustomizingYourTheme>/g,
        /<CustomizingYourSpacingScale[\s\S]*?\/>/g,
        /<TargetingSpecificStates[\s\S]*?>/g,
        /<\/TargetingSpecificStates>/g,
    ];
    for (const pattern of boilerplatePatterns) {
        result = result.replace(pattern, "");
    }
    // 定型コンポーネントに対応する見出しも除去
    // ### Responsive design, ### Using a custom value, ## Customizing your theme 等
    const boilerplateHeadings = [
        /^###?\s+Responsive design\s*$/gm,
        /^###?\s+Using a custom value\s*$/gm,
        /^###?\s+Customizing your theme\s*$/gm,
    ];
    for (const pattern of boilerplateHeadings) {
        result = result.replace(pattern, "");
    }
    // Tip コンポーネント — 中のテキストをブロック引用に変換
    // <TipBad>text</TipBad> → > **Bad:** text
    // <TipGood>text</TipGood> → > **Good:** text
    // <TipInfo>text</TipInfo> → > **Info:** text
    // JSX 式コンテナ {<>...</>} を含む場合もある
    const tipPatterns = [
        [/<TipBad>\s*\{?\s*(?:<>)?\s*([\s\S]*?)\s*(?:<\/>)?\s*\}?\s*<\/TipBad>/g, "> **Bad:** $1"],
        [/<TipGood>\s*\{?\s*(?:<>)?\s*([\s\S]*?)\s*(?:<\/>)?\s*\}?\s*<\/TipGood>/g, "> **Good:** $1"],
        [/<TipInfo>\s*\{?\s*(?:<>)?\s*([\s\S]*?)\s*(?:<\/>)?\s*\}?\s*<\/TipInfo>/g, "> **Info:** $1"],
    ];
    for (const [pattern, replacement] of tipPatterns) {
        result = result.replace(pattern, replacement);
    }
    return result;
}
// =============================================================================
// JSX ラッパー除去
// =============================================================================
/** ラッパー系コンポーネントの開始/終了タグを除去（中身は保持） */
function removeJsxWrappers(content) {
    const wrapperTags = [
        "Figure",
        "Example",
        "Stripes",
        "CodeExampleStack",
        "CodeExampleGroup",
        "CodeExampleWrapper",
        "CodeBlock",
        "MultiCursorAnimation",
        "MultiCursorCode",
        "MultiCursorPreview",
    ];
    let result = content;
    for (const tag of wrapperTags) {
        // 開始タグ（属性付き、複数行対応）
        result = result.replace(new RegExp(`<${tag}(?:\\s[\\s\\S]*?)?>`, "g"), "");
        // 閉じタグ
        result = result.replace(new RegExp(`</${tag}>`, "g"), "");
    }
    return result;
}
// =============================================================================
// 自己閉じ JSX 除去
// =============================================================================
/** 残った自己閉じ JSX タグを除去（コンポーネント名が大文字始まり） */
function removeSelfClosingJsx(content) {
    return content.replace(/<[A-Z][a-zA-Z]*(?:\s[\s\S]*?)?\s*\/>/g, "");
}
// =============================================================================
// JSX 式コンテナ → コードブロック
// =============================================================================
/**
 * Example 内の JSX デモコードを除去。
 *
 * 対応パターン:
 * 1. 複数行ブロック: 行頭の { で始まり JSX を含み } で終わるブロック
 * 2. インライン式: {<element className=...>...</element>} や {<element ... />}
 * 3. 孤立した JSX 要素行: <img className=... />, <div>, </div> 等
 * 4. JSX コメント: {/* ... *\/}
 *
 * コードブロック (```) 内の className はドキュメント用コード例なので保持する。
 */
function transformJsxExpressions(content) {
    const lines = content.split("\n");
    const result = [];
    let i = 0;
    let inCodeBlock = false;
    while (i < lines.length) {
        const trimmed = lines[i].trim();
        // コードブロック内はスキップ（変換しない）
        if (trimmed.startsWith("```")) {
            inCodeBlock = !inCodeBlock;
            result.push(lines[i]);
            i++;
            continue;
        }
        if (inCodeBlock) {
            result.push(lines[i]);
            i++;
            continue;
        }
        // パターン 1: 複数行 JSX ブロック { ... }
        if (trimmed === "{") {
            let hasJsx = false;
            let j = i + 1;
            let depth = 1;
            while (j < lines.length && depth > 0) {
                const lt = lines[j].trim();
                if (lt === "{")
                    depth++;
                else if (lt === "}")
                    depth--;
                if (depth > 0 && /^<[a-z]/i.test(lt))
                    hasJsx = true;
                if (depth > 0 && /className=/.test(lt))
                    hasJsx = true;
                j++;
            }
            if (hasJsx && depth === 0) {
                i = j;
                continue;
            }
        }
        // パターン 2: インライン JSX 式 {<element ...>...</element>} or {<element ... />}
        if (/^\s*\{<[a-z]/i.test(lines[i]) && /className=/.test(lines[i])) {
            // 単一行で閉じている場合
            if (/\}\s*$/.test(trimmed)) {
                i++;
                continue;
            }
            // 複数行の場合 — 対応する } まで除去
            let j = i + 1;
            while (j < lines.length && !/^\s*\}\s*$/.test(lines[j].trim()) && !lines[j].includes("}")) {
                j++;
            }
            i = j + 1;
            continue;
        }
        // パターン 3: JSX 要素行（className を含む、または後続行に className がある）
        // 単一行: <img ... className="..." /> や <details className="...">
        // 複数行: <img\n  className=...\n  src=...\n/>
        if (/^\s*<[a-z][\w-]*[\s>]/.test(lines[i]) && !trimmed.startsWith("<http")) {
            // 単一行で className を含む場合
            if (/className=/.test(lines[i])) {
                // 自己閉じ or 開きタグ — 対応する閉じまでスキップ
                const blockEnd = findJsxElementEnd(lines, i);
                i = blockEnd + 1;
                continue;
            }
            // 複数行: この要素ブロック全体を先読みして className を含むか確認
            const blockEnd = findJsxElementEnd(lines, i);
            if (blockEnd > i) {
                const blockText = lines.slice(i, blockEnd + 1).join("\n");
                if (/className=/.test(blockText)) {
                    i = blockEnd + 1;
                    continue;
                }
            }
        }
        // パターン 4: JSX コメント {/* ... */}
        if (/^\s*\{\/\*/.test(lines[i])) {
            // 単行コメント
            if (/\*\/\}\s*$/.test(trimmed)) {
                i++;
                continue;
            }
            // 複数行コメント
            let j = i + 1;
            while (j < lines.length && !/\*\/\}/.test(lines[j])) {
                j++;
            }
            i = j + 1;
            continue;
        }
        // パターン 3b: 属性行のみ残留（<img の行は前のイテレーションで除去済みだが属性行が残る場合）
        if (/^\s+className=/.test(lines[i]) || /^\s+src=/.test(lines[i])) {
            i++;
            continue;
        }
        // 孤立した </div>, </span> 等の閉じタグ（コードブロック外）
        if (/^\s*<\/[a-z][\w-]*>\s*$/.test(lines[i])) {
            i++;
            continue;
        }
        // 孤立した空の <div> 等の開始タグ（コードブロック外）
        if (/^\s*<[a-z][\w-]*>\s*$/.test(lines[i]) && !trimmed.startsWith("<http")) {
            i++;
            continue;
        }
        result.push(lines[i]);
        i++;
    }
    return result.join("\n");
}
//# sourceMappingURL=tailwindcss-mdx-transform.js.map