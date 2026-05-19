/**
 * Frontmatter Validator
 *
 * YAML front matter の解析と検証
 */
import type { FrontmatterFieldRule } from "../lint/docs-types.js";
/**
 * 解析されたフロントマター
 */
export interface ParsedFrontmatter {
    /** フロントマターが存在するか */
    hasFrontmatter: boolean;
    /** 解析されたデータ */
    data?: Record<string, unknown>;
    /** 解析エラー */
    parseError?: string;
    /** フロントマター後のコンテンツ */
    content: string;
}
/**
 * フィールド検証結果
 */
export interface FieldValidationResult {
    /** 有効か */
    valid: boolean;
    /** エラーメッセージ */
    error?: string;
}
/**
 * フロントマターを解析する
 */
export declare function parseFrontmatter(content: string): ParsedFrontmatter;
/**
 * フロントマターフィールドを検証する
 */
export declare function validateFrontmatterField(data: Record<string, unknown>, field: FrontmatterFieldRule): FieldValidationResult;
/**
 * 日付フォーマットを検証する
 */
export declare function validateDateFormat(value: unknown, format: string | undefined): boolean;
//# sourceMappingURL=frontmatter.d.ts.map