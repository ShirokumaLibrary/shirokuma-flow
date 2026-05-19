/**
 * details-zod - Zodスキーマ解析
 *
 * ZodスキーマからパラメータをJSON形式で抽出する。
 */
import { escapeRegExp } from "../utils/sanitize.js";
import { findMatchingBrace } from "../utils/brace-matching.js";
/**
 * Zodスキーマを解析してパラメータ情報を抽出
 *
 * @param schemaName スキーマ名 (例: "CreateEntitySchema")
 * @param fileContent ファイルの内容
 * @returns Zodスキーマ情報
 */
export function parseZodSchema(schemaName, fileContent) {
    const schemaStartPattern = new RegExp(`(?:export\\s+)?(?:const|let)\\s+${escapeRegExp(schemaName)}\\s*=\\s*z\\.object\\s*\\(\\s*\\{`, "s");
    const startMatch = schemaStartPattern.exec(fileContent);
    if (!startMatch) {
        return null;
    }
    const openBraceIndex = startMatch.index + startMatch[0].length - 1;
    const closingBrace = findMatchingBrace(fileContent, openBraceIndex);
    if (closingBrace === null)
        return null;
    const schemaBody = fileContent.slice(openBraceIndex + 1, closingBrace);
    const parameters = [];
    const fieldPattern = /(\w+)\s*:\s*z\s*((?:\.\w+\s*\([^)]*\)\s*)+)/g;
    let fieldMatch;
    while ((fieldMatch = fieldPattern.exec(schemaBody)) !== null) {
        const fieldName = fieldMatch[1];
        const chainCalls = fieldMatch[2] || "";
        const typeMatch = chainCalls.match(/\.(\w+)\s*\(/);
        const zodType = typeMatch ? typeMatch[1] : "unknown";
        const modifiers = chainCalls;
        const param = {
            name: fieldName,
            type: mapZodTypeToJsonType(zodType),
            required: !modifiers.includes(".optional()") && !modifiers.includes(".nullable()"),
        };
        // .describe() から説明を抽出
        const describeMatch = modifiers.match(/\.describe\s*\(\s*["']([^"']+)["']\s*\)/);
        if (describeMatch) {
            param.description = describeMatch[1];
        }
        // .min() / .max() を抽出
        const minMatch = modifiers.match(/\.min\s*\(\s*(\d+)(?:\s*,\s*["']([^"']+)["'])?\s*\)/);
        if (minMatch) {
            if (zodType === "string") {
                param.minLength = parseInt(minMatch[1], 10);
            }
            else {
                param.minimum = parseInt(minMatch[1], 10);
            }
            if (minMatch[2]) {
                param.validation = { message: minMatch[2] };
            }
        }
        const maxMatch = modifiers.match(/\.max\s*\(\s*(\d+)(?:\s*,\s*["']([^"']+)["'])?\s*\)/);
        if (maxMatch) {
            if (zodType === "string") {
                param.maxLength = parseInt(maxMatch[1], 10);
            }
            else {
                param.maximum = parseInt(maxMatch[1], 10);
            }
            if (maxMatch[2] && !param.validation) {
                param.validation = { message: maxMatch[2] };
            }
        }
        // .uuid() / .email() 等のフォーマット
        if (modifiers.includes(".uuid(")) {
            param.format = "uuid";
            const uuidMatch = modifiers.match(/\.uuid\s*\(\s*["']([^"']+)["']\s*\)/);
            if (uuidMatch && !param.validation) {
                param.validation = { message: uuidMatch[1] };
            }
        }
        if (modifiers.includes(".email(")) {
            param.format = "email";
            const emailMatch = modifiers.match(/\.email\s*\(\s*["']([^"']+)["']\s*\)/);
            if (emailMatch && !param.validation) {
                param.validation = { message: emailMatch[1] };
            }
        }
        if (modifiers.includes(".url(")) {
            param.format = "url";
        }
        // .default() を抽出
        const defaultMatch = modifiers.match(/\.default\s*\(\s*["']?([^"')]+)["']?\s*\)/);
        if (defaultMatch) {
            const defaultValue = defaultMatch[1];
            if (defaultValue === "true" || defaultValue === "false") {
                param.default = defaultValue === "true";
            }
            else if (!isNaN(Number(defaultValue))) {
                param.default = Number(defaultValue);
            }
            else {
                param.default = defaultValue;
            }
        }
        // z.enum() の値を抽出
        if (zodType === "enum") {
            const enumMatch = fieldMatch[0].match(/z\.enum\s*\(\s*\[([^\]]+)\]/);
            if (enumMatch) {
                param.enum = enumMatch[1]
                    .split(",")
                    .map((v) => v.trim().replace(/['"]/g, ""));
                param.type = "enum";
            }
        }
        parameters.push(param);
    }
    return {
        name: schemaName,
        parameters,
    };
}
/**
 * Zod型をJSON Schema型にマッピング
 */
export function mapZodTypeToJsonType(zodType) {
    const typeMap = {
        string: "string",
        number: "number",
        boolean: "boolean",
        date: "string",
        array: "array",
        object: "object",
        enum: "enum",
        literal: "literal",
        union: "union",
        intersection: "intersection",
        tuple: "tuple",
        record: "record",
        map: "map",
        set: "set",
    };
    return typeMap[zodType] || "unknown";
}
//# sourceMappingURL=details-zod.js.map