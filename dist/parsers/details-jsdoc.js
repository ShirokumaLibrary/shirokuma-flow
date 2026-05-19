/**
 * details-jsdoc - JSDoc解析・コードフォーマット
 *
 * 詳細ページ用のJSDoc解析、コード整形、マークダウン変換を行う。
 */
import { escapeHtml } from "../utils/html.js";
import { extractJsDocBefore } from "./jsdoc-common.js";
/**
 * JSDocを整形
 *
 * 行頭のインデントを保持しつつ、JSDocの * を除去する
 */
export function cleanJSDoc(jsDoc) {
    return jsDoc
        .replace(/\/\*\*|\*\//g, "")
        .split("\n")
        .map((line) => line.replace(/^\s*\*\s?/, "").trimEnd())
        .filter((line, index, arr) => {
        if (line.length === 0) {
            return index > 0 && index < arr.length - 1;
        }
        return true;
    })
        .join("\n");
}
/**
 * コードをエスケープ（highlight.js はCDNから読み込み）
 */
export function formatCode(code) {
    return escapeHtml(code);
}
/**
 * 簡易マークダウン変換（コードブロック対応）
 */
export function simpleMarkdown(text) {
    if (!text)
        return "";
    // コードブロックを一時的にプレースホルダーに置換（escapeHtml 適用済み）
    const codeBlocks = [];
    let result = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        const index = codeBlocks.length;
        const langClass = lang ? `language-${lang}` : "";
        codeBlocks.push(`<pre class="code-block"><code class="${langClass}">${escapeHtml(code.trim())}</code></pre>`);
        return `\n\n__CODE_BLOCK_${index}__\n\n`;
    });
    // インラインコードをプレースホルダーに置換（escapeHtml 適用済み）
    const inlineCodes = [];
    result = result.replace(/`([^`]+)`/g, (_, code) => {
        const index = inlineCodes.length;
        inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
        return `__INLINE_CODE_${index}__`;
    });
    // 残りのテキストを HTML エスケープ（プレースホルダーは安全な文字列のため影響なし）
    result = escapeHtml(result);
    // 段落分割（空行で区切る）
    const paragraphs = result.split(/\n\n+/);
    result = paragraphs
        .map((p) => {
        const trimmed = p.trim();
        if (trimmed.startsWith("__CODE_BLOCK_"))
            return trimmed;
        if (!trimmed)
            return "";
        return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
        .filter(Boolean)
        .join("\n");
    // インラインコードを復元
    inlineCodes.forEach((code, i) => {
        result = result.replace(`__INLINE_CODE_${i}__`, code);
    });
    // コードブロックを復元
    codeBlocks.forEach((block, i) => {
        result = result.replace(`__CODE_BLOCK_${i}__`, block);
    });
    return result;
}
/**
 * JSDocコメントを抽出（共通パーサー使用）
 *
 * 関数宣言の位置を先に特定し、その直前にあるJSDocコメントを抽出する。
 */
export function extractJSDoc(sourceCode, targetName) {
    const jsDocBlock = extractJsDocBefore(sourceCode, targetName);
    if (!jsDocBlock) {
        return "";
    }
    return cleanJSDoc(jsDocBlock);
}
/**
 * JSDocをパースして構造化データにする
 */
export function parseJSDoc(jsDoc) {
    const result = {
        description: "",
        params: [],
        returns: undefined,
        throws: [],
        examples: [],
        tags: [],
    };
    if (!jsDoc)
        return result;
    const lines = jsDoc.split("\n");
    let currentTag = null;
    let currentContent = [];
    let inExample = false;
    const flushContent = () => {
        if (!currentTag) {
            const desc = currentContent.join("\n").trim();
            if (desc && !result.description) {
                result.description = desc;
            }
        }
        else if (currentTag === "param") {
            const text = currentContent.join(" ").trim();
            const match = text.match(/^(?:\{([^}]+)\}\s+)?(\w+)\s*[-–]?\s*(.*)/);
            if (match) {
                result.params.push({
                    name: match[2],
                    type: match[1],
                    description: match[3],
                });
            }
        }
        else if (currentTag === "returns" || currentTag === "return") {
            result.returns = currentContent.join(" ").trim();
        }
        else if (currentTag === "throws" || currentTag === "throw") {
            result.throws?.push(currentContent.join(" ").trim());
        }
        else if (currentTag === "example") {
            result.examples.push(currentContent.join("\n").trim());
        }
        else if (currentTag === "description") {
            const desc = currentContent.join("\n").trim();
            if (desc)
                result.description = desc;
        }
        else {
            result.tags.push({
                name: currentTag,
                value: currentContent.join(" ").trim(),
            });
        }
        currentContent = [];
    };
    for (const line of lines) {
        const tagMatch = line.match(/^@(\w+)\s*(.*)/);
        if (tagMatch) {
            flushContent();
            currentTag = tagMatch[1];
            if (tagMatch[2]) {
                currentContent.push(tagMatch[2]);
            }
            inExample = currentTag === "example";
        }
        else if (inExample) {
            currentContent.push(line);
        }
        else {
            currentContent.push(line);
        }
    }
    flushContent();
    return result;
}
/**
 * JSDocをパースしてJSON出力用の構造化データにする
 */
export function parseJSDocForJson(jsDoc) {
    const result = {
        description: "",
        params: [],
        returns: undefined,
        throws: [],
        examples: [],
        tags: [],
    };
    if (!jsDoc)
        return result;
    const lines = jsDoc.split("\n");
    let currentTag = null;
    let currentContent = [];
    let inExample = false;
    const flushContent = () => {
        if (!currentTag) {
            const desc = currentContent.join("\n").trim();
            if (desc && !result.description) {
                result.description = desc;
            }
        }
        else if (currentTag === "param") {
            const text = currentContent.join(" ").trim();
            const match = text.match(/^(?:\{([^}]+)\}\s+)?(\w+)\s*[-–]?\s*(.*)/);
            if (match) {
                result.params.push({
                    name: match[2],
                    type: match[1],
                    description: match[3],
                });
            }
        }
        else if (currentTag === "returns" || currentTag === "return") {
            result.returns = currentContent.join(" ").trim();
        }
        else if (currentTag === "throws" || currentTag === "throw") {
            result.throws?.push(currentContent.join(" ").trim());
        }
        else if (currentTag === "example") {
            result.examples.push(currentContent.join("\n").trim());
        }
        else if (currentTag === "description") {
            const desc = currentContent.join("\n").trim();
            if (desc)
                result.description = desc;
        }
        else {
            const multilineTags = ["errorCodes"];
            const separator = multilineTags.includes(currentTag) ? "\n" : " ";
            result.tags.push({
                name: currentTag,
                value: currentContent.join(separator).trim(),
            });
        }
        currentContent = [];
    };
    for (const line of lines) {
        const tagMatch = line.match(/^@(\w+)\s*(.*)/);
        if (tagMatch) {
            flushContent();
            currentTag = tagMatch[1];
            if (tagMatch[2]) {
                currentContent.push(tagMatch[2]);
            }
            inExample = currentTag === "example";
        }
        else if (inExample) {
            currentContent.push(line);
        }
        else {
            currentContent.push(line);
        }
    }
    flushContent();
    return result;
}
/**
 * 型定義のソースコードをJSDoc部分と定義部分に分離
 */
export function splitTypeSourceCode(sourceCode) {
    const jsdocEndIndex = sourceCode.indexOf("*/");
    if (jsdocEndIndex === -1) {
        return { jsdocHtml: "", definitionCode: sourceCode.trim() };
    }
    const jsdocPart = sourceCode.slice(0, jsdocEndIndex + 2);
    const cleanedJsdoc = cleanJSDoc(jsdocPart);
    const descriptionLines = cleanedJsdoc
        .split("\n")
        .filter((line) => !line.trim().startsWith("@"))
        .join("\n")
        .trim();
    const jsdocHtml = descriptionLines ? simpleMarkdown(descriptionLines) : "";
    const definitionCode = sourceCode.slice(jsdocEndIndex + 2).trim();
    return { jsdocHtml, definitionCode };
}
//# sourceMappingURL=details-jsdoc.js.map