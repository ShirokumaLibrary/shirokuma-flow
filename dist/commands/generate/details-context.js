/**
 * details-context - コンテキスト管理・要素リンク解決
 *
 * DetailsContext の作成、要素マップ管理、リンク解決、
 * モジュール名抽出、ソースコード読み込みを提供する。
 */
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { escapeRegExp } from "../../utils/sanitize.js";
import { findMatchingBrace } from "../../utils/brace-matching.js";
// ===== コンテキスト作成 =====
/**
 * 空の DetailsContext を作成
 */
export function createDetailsContext() {
    return {
        allTestCases: [],
        detailsJsonItems: {},
        existingElements: {
            screens: new Map(),
            components: new Map(),
            actions: new Map(),
            modules: new Map(),
            tables: new Map(),
        },
    };
}
// ===== モジュール名・キー =====
/**
 * ファイルパスからモジュール名を抽出
 */
export function extractModuleName(filePath) {
    const segments = filePath.replace(/\\/g, "/").split("/");
    const fileName = segments[segments.length - 1].replace(/\.(ts|tsx|js|jsx)$/, "");
    const excludeDirs = ["app", "lib", "src", "components", "actions", "schema", "apps", "packages", "web", "admin", "public"];
    for (let i = segments.length - 2; i >= 0; i--) {
        const dir = segments[i];
        if (dir.startsWith("(") && dir.endsWith(")")) {
            return dir.slice(1, -1);
        }
        if (dir.startsWith("[") && dir.endsWith("]")) {
            continue;
        }
        if (!excludeDirs.includes(dir.toLowerCase()) && dir.length > 0) {
            return dir;
        }
    }
    return fileName;
}
/**
 * 要素の完全キーを生成
 */
export function getElementFullKey(moduleName, elementName) {
    return `${moduleName}/${elementName}`;
}
// ===== リンク解決 =====
/**
 * linkTypeに対応する存在要素マップを取得
 */
export function getExistingMap(ctx, linkType) {
    switch (linkType) {
        case "screen":
            return ctx.existingElements.screens;
        case "component":
            return ctx.existingElements.components;
        case "action":
            return ctx.existingElements.actions;
        case "module":
            return ctx.existingElements.modules;
        case "table":
            return ctx.existingElements.tables;
        default:
            return new Map();
    }
}
/**
 * 要素名からリンク情報を検索
 */
export function findElementLink(ctx, linkType, elementName) {
    const map = getExistingMap(ctx, linkType);
    for (const [fullKey, module] of map.entries()) {
        const name = fullKey.split("/")[1];
        if (name === elementName) {
            return { module };
        }
    }
    return null;
}
// ===== ソースコード読み込み =====
/**
 * ソースコードを読み込み
 */
export function readSourceCode(projectPath, filePath) {
    const fullPath = resolve(projectPath, filePath);
    if (!existsSync(fullPath)) {
        return `// File not found: ${filePath}`;
    }
    try {
        return readFileSync(fullPath, "utf-8");
    }
    catch {
        return `// Error reading file: ${filePath}`;
    }
}
/**
 * 関数/コンポーネントのコードを抽出
 */
export function extractFunctionCode(sourceCode, targetName) {
    const escaped = escapeRegExp(targetName);
    const patterns = [
        new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${escaped}\\s*[<({]`, "gm"),
        new RegExp(`(?:export\\s+)?const\\s+${escaped}\\s*=`, "gm"),
        new RegExp(`(?:export\\s+)?(?:default\\s+)?function\\s+${escaped}\\s*[<({]`, "gm"),
    ];
    for (const pattern of patterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(sourceCode);
        if (match) {
            let startIndex = match.index;
            // 直前のJSDocコメントを探す
            const before = sourceCode.slice(0, startIndex);
            const lastCommentEnd = before.lastIndexOf("*/");
            if (lastCommentEnd !== -1) {
                const afterComment = before.slice(lastCommentEnd + 2);
                if (/^\s*$/.test(afterComment)) {
                    const commentStart = before.lastIndexOf("/**", lastCommentEnd);
                    if (commentStart !== -1) {
                        startIndex = commentStart;
                    }
                }
            }
            // 関数シグネチャをスキップして関数本体の { を見つける
            let parenDepth = 0;
            let bodyStartIndex = match.index;
            let foundParenStart = false;
            let inStringSig = false;
            let stringCharSig = "";
            for (let i = match.index; i < sourceCode.length; i++) {
                const char = sourceCode[i];
                const prevChar = sourceCode[i - 1];
                if (!inStringSig && (char === '"' || char === "'" || char === "`") && prevChar !== "\\") {
                    inStringSig = true;
                    stringCharSig = char;
                }
                else if (inStringSig && char === stringCharSig && prevChar !== "\\") {
                    inStringSig = false;
                }
                else if (!inStringSig) {
                    if (char === "(") {
                        parenDepth++;
                        foundParenStart = true;
                    }
                    else if (char === ")") {
                        parenDepth--;
                    }
                    else if (char === "{" && foundParenStart && parenDepth === 0) {
                        bodyStartIndex = i;
                        break;
                    }
                }
            }
            // 関数本体の括弧の深さで終了位置を特定（文字列・コメント考慮）
            const closingBrace = findMatchingBrace(sourceCode, bodyStartIndex);
            const endIndex = closingBrace !== null ? closingBrace + 1 : bodyStartIndex;
            if (endIndex > bodyStartIndex) {
                return sourceCode.slice(startIndex, endIndex).trim();
            }
        }
    }
    return sourceCode;
}
//# sourceMappingURL=details-context.js.map