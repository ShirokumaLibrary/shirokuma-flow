/**
 * server-action-structure ルール
 *
 * Server Action が以下の順序を守っているか検証:
 * 1. verifyAuth() または verifyAuthMutation() が最初
 * 2. CSRF検証（mutation時）
 * 3. Zodスキーマによる入力検証
 *
 * @module lint/rules/server-action-structure
 */
import { escapeRegExp } from "../../utils/sanitize.js";
import { findMatchingBrace } from "../../utils/brace-matching.js";
/**
 * 認証関数のパターン
 */
const AUTH_PATTERNS = [
    /await\s+verifyAuth\s*\(/,
    /await\s+verifyAuthMutation\s*\(/,
    /const\s+\w+\s*=\s*await\s+verifyAuth\s*\(/,
    /const\s+\w+\s*=\s*await\s+verifyAuthMutation\s*\(/,
];
/**
 * CSRF 検証関数のパターン
 */
const CSRF_PATTERNS = [
    /await\s+validateCSRF\s*\(/,
    /await\s+csrfProtect\s*\(/,
];
/**
 * Zod バリデーションのパターン
 */
const ZOD_PATTERNS = [
    /\.parse\s*\(/,
    /\.safeParse\s*\(/,
    /\.parseAsync\s*\(/,
    /\.safeParseAsync\s*\(/,
];
/**
 * 関数本体を抽出
 */
function extractFunctionBody(content, functionName) {
    // export async function functionName(...) { ... }
    // export function functionName(...) { ... }
    const funcPattern = new RegExp(`export\\s+(?:async\\s+)?function\\s+${escapeRegExp(functionName)}\\s*\\([^)]*\\)\\s*\\{`, "g");
    const match = funcPattern.exec(content);
    if (!match) {
        return null;
    }
    const openBraceIndex = match.index + match[0].length - 1;
    const closingBrace = findMatchingBrace(content, openBraceIndex);
    if (closingBrace === null)
        return null;
    return content.slice(openBraceIndex + 1, closingBrace);
}
/**
 * パターンの最初の出現位置を取得
 */
function findFirstMatch(body, patterns) {
    let minIndex = -1;
    for (const pattern of patterns) {
        const match = pattern.exec(body);
        if (match) {
            const index = match.index;
            if (minIndex === -1 || index < minIndex) {
                minIndex = index;
            }
        }
    }
    return minIndex;
}
/**
 * Server Action 構造検証ルール
 */
export const serverActionStructureRule = {
    id: "server-action-structure",
    severity: "error",
    description: "Server Action must follow the order: auth -> CSRF (optional) -> Zod validation",
    check(content, filePath, functionName, functionLine) {
        const issues = [];
        // "use server" がない場合はスキップ
        if (!content.includes('"use server"') && !content.includes("'use server'")) {
            return issues;
        }
        // 関数本体を抽出
        const body = extractFunctionBody(content, functionName);
        if (!body) {
            return issues;
        }
        // 認証呼び出しの位置を検出
        const authIndex = findFirstMatch(body, AUTH_PATTERNS);
        // 認証がない場合はエラー
        if (authIndex === -1) {
            issues.push({
                type: "error",
                message: `関数 ${functionName} に認証呼び出し (verifyAuth/verifyAuthMutation) がありません`,
                file: filePath,
                line: functionLine,
                rule: "server-action-structure",
                functionName,
            });
            return issues; // 認証がない場合は他のチェックは意味がない
        }
        // Zod バリデーションの位置を検出
        const zodIndex = findFirstMatch(body, ZOD_PATTERNS);
        // Zod バリデーションがない場合は警告
        if (zodIndex === -1) {
            issues.push({
                type: "warning",
                message: `関数 ${functionName} に Zod バリデーション (.parse/.safeParse) がありません`,
                file: filePath,
                line: functionLine,
                rule: "server-action-structure",
                functionName,
            });
        }
        else {
            // Zod が認証より前にある場合はエラー
            if (zodIndex < authIndex) {
                issues.push({
                    type: "error",
                    message: `関数 ${functionName} で認証が Zod バリデーションより後に実行されています。順序: 認証 -> バリデーション`,
                    file: filePath,
                    line: functionLine,
                    rule: "server-action-structure",
                    functionName,
                });
            }
        }
        // CSRF 検証の位置を検出
        const csrfIndex = findFirstMatch(body, CSRF_PATTERNS);
        // CSRF がある場合、認証より前にあるとエラー
        if (csrfIndex !== -1 && csrfIndex < authIndex) {
            issues.push({
                type: "error",
                message: `関数 ${functionName} で CSRF 検証が認証より前に実行されています。順序: 認証 -> CSRF`,
                file: filePath,
                line: functionLine,
                rule: "server-action-structure",
                functionName,
            });
        }
        return issues;
    },
};
//# sourceMappingURL=server-action-structure.js.map