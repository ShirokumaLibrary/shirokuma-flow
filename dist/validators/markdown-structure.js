/**
 * Markdown Structure Validator
 *
 * Markdown ドキュメントの構造を検証
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter, validateFrontmatterField } from "./frontmatter.js";
import { extractLinks, validateInternalLink } from "./link-checker.js";
import { safeRegExp } from "../utils/sanitize.js";
/**
 * 空の検証結果を作成
 */
function createEmptyResult() {
    return {
        valid: true,
        errors: [],
        warnings: [],
        infos: [],
    };
}
/**
 * ファイル存在チェック
 */
export function checkFileExists(filePath) {
    const result = createEmptyResult();
    if (!existsSync(filePath)) {
        result.valid = false;
        result.errors.push({
            type: "error",
            message: `File not found: ${filePath}`,
            file: filePath,
            rule: "file-exists",
        });
    }
    return result;
}
/**
 * セクション構造チェック
 */
export function checkSections(content, rules, filePath) {
    const result = createEmptyResult();
    const lines = content.split("\n");
    for (const rule of rules) {
        const pattern = safeRegExp(rule.pattern, "m");
        if (!pattern) {
            result.valid = false;
            result.errors.push({
                type: "error",
                message: `Invalid regex pattern: ${rule.pattern} (${rule.description})`,
                file: filePath,
                rule: "invalid-pattern",
            });
            continue;
        }
        const found = lines.some((line) => pattern.test(line));
        if (!found) {
            if (rule.required) {
                result.valid = false;
                result.errors.push({
                    type: "error",
                    message: `Missing required section: ${rule.description} (pattern: ${rule.pattern})`,
                    file: filePath,
                    rule: "section-required",
                });
            }
            else {
                result.warnings.push({
                    type: "warning",
                    message: `Missing optional section: ${rule.description} (pattern: ${rule.pattern})`,
                    file: filePath,
                    rule: "section-optional",
                });
            }
        }
    }
    return result;
}
/**
 * ドキュメント長さチェック
 */
export function checkDocumentLength(content, lengthRule, filePath) {
    const result = createEmptyResult();
    const lineCount = content.split("\n").length;
    if (lengthRule.minLength !== undefined && lineCount < lengthRule.minLength) {
        result.valid = false;
        result.errors.push({
            type: "error",
            message: `Document too short: ${lineCount} lines (minimum: ${lengthRule.minLength})`,
            file: filePath,
            rule: "min-length",
        });
    }
    if (lengthRule.maxLength !== undefined && lineCount > lengthRule.maxLength) {
        result.warnings.push({
            type: "warning",
            message: `Document too long: ${lineCount} lines (maximum: ${lengthRule.maxLength})`,
            file: filePath,
            rule: "max-length",
        });
    }
    return result;
}
/**
 * フロントマターチェック
 */
export function checkFrontmatter(content, rules, filePath) {
    const result = createEmptyResult();
    const parsed = parseFrontmatter(content);
    // フロントマターが必須だが存在しない場合
    if (rules.required && !parsed.hasFrontmatter) {
        result.valid = false;
        result.errors.push({
            type: "error",
            message: "Required frontmatter is missing",
            file: filePath,
            rule: "frontmatter-required",
        });
        return result;
    }
    // フロントマターがない場合はここで終了
    if (!parsed.hasFrontmatter || !parsed.data) {
        return result;
    }
    // 解析エラーがある場合
    if (parsed.parseError) {
        result.valid = false;
        result.errors.push({
            type: "error",
            message: `Failed to parse frontmatter: ${parsed.parseError}`,
            file: filePath,
            rule: "frontmatter-parse",
        });
        return result;
    }
    // フィールド検証
    for (const field of rules.fields) {
        const fieldResult = validateFrontmatterField(parsed.data, field);
        if (!fieldResult.valid && fieldResult.error) {
            result.valid = false;
            result.errors.push({
                type: "error",
                message: fieldResult.error,
                file: filePath,
                rule: "frontmatter-field",
            });
        }
    }
    return result;
}
/**
 * 内部リンクチェック
 */
export function checkInternalLinks(content, basePath, filePath) {
    const result = createEmptyResult();
    const links = extractLinks(content);
    for (const link of links) {
        const linkResult = validateInternalLink(link, basePath, filePath);
        if (!linkResult.valid && linkResult.error) {
            result.valid = false;
            result.errors.push({
                type: "error",
                message: linkResult.error,
                file: filePath,
                line: link.line,
                rule: "internal-link",
            });
        }
    }
    return result;
}
/**
 * ファイルパターンチェック
 */
export function checkFilePattern(directory, pattern, options, description) {
    const result = {
        valid: true,
        errors: [],
        warnings: [],
        infos: [],
        matchedFiles: [],
    };
    if (!existsSync(directory)) {
        result.valid = false;
        result.errors.push({
            type: "error",
            message: `Directory not found: ${directory}`,
            file: directory,
            rule: "directory-exists",
        });
        return result;
    }
    // 正規表現パターンに変換
    // [0-9] のような文字クラスはそのまま保持
    const regexPattern = pattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, ".*");
    const regex = safeRegExp(`^${regexPattern}$`);
    if (!regex) {
        result.valid = false;
        result.errors.push({
            type: "error",
            message: `Invalid file pattern: ${pattern}`,
            file: directory,
            rule: "invalid-pattern",
        });
        return result;
    }
    // ディレクトリ内のファイルをスキャン
    try {
        const files = readdirSync(directory);
        for (const file of files) {
            const fullPath = join(directory, file);
            if (statSync(fullPath).isFile() && regex.test(file)) {
                result.matchedFiles.push(fullPath);
            }
        }
    }
    catch (error) {
        result.valid = false;
        result.errors.push({
            type: "error",
            message: `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`,
            file: directory,
            rule: "directory-read",
        });
        return result;
    }
    // 最小ファイル数チェック
    if (options.minCount !== undefined && result.matchedFiles.length < options.minCount) {
        result.valid = false;
        result.errors.push({
            type: "error",
            message: `${description}: Found ${result.matchedFiles.length} files, minimum required: ${options.minCount}`,
            file: directory,
            rule: "min-file-count",
        });
    }
    // 最大ファイル数チェック
    if (options.maxCount !== undefined && result.matchedFiles.length > options.maxCount) {
        result.warnings.push({
            type: "warning",
            message: `${description}: Found ${result.matchedFiles.length} files, maximum recommended: ${options.maxCount}`,
            file: directory,
            rule: "max-file-count",
        });
    }
    return result;
}
/**
 * 検証結果をマージする
 */
export function mergeResults(...results) {
    const merged = createEmptyResult();
    for (const result of results) {
        if (!result.valid) {
            merged.valid = false;
        }
        merged.errors.push(...result.errors);
        merged.warnings.push(...result.warnings);
        merged.infos.push(...result.infos);
    }
    return merged;
}
/**
 * ファイル内容を読み込む
 */
export function readFileContent(filePath) {
    if (!existsSync(filePath)) {
        return null;
    }
    return readFileSync(filePath, "utf-8");
}
//# sourceMappingURL=markdown-structure.js.map