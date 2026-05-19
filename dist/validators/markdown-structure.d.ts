/**
 * Markdown Structure Validator
 *
 * Markdown ドキュメントの構造を検証
 */
import type { DocValidationResult, SectionRule, FrontmatterRule, LengthRule } from "../lint/docs-types.js";
export type { DocValidationResult, SectionRule, FrontmatterRule };
/**
 * ファイル存在チェック
 */
export declare function checkFileExists(filePath: string): DocValidationResult;
/**
 * セクション構造チェック
 */
export declare function checkSections(content: string, rules: SectionRule[], filePath: string): DocValidationResult;
/**
 * ドキュメント長さチェック
 */
export declare function checkDocumentLength(content: string, lengthRule: LengthRule, filePath: string): DocValidationResult;
/**
 * フロントマターチェック
 */
export declare function checkFrontmatter(content: string, rules: FrontmatterRule, filePath: string): DocValidationResult;
/**
 * 内部リンクチェック
 */
export declare function checkInternalLinks(content: string, basePath: string, filePath: string): DocValidationResult;
/**
 * ファイルパターンチェック結果
 */
export interface FilePatternResult extends DocValidationResult {
    /** マッチしたファイル */
    matchedFiles: string[];
}
/**
 * ファイルパターンチェック
 */
export declare function checkFilePattern(directory: string, pattern: string, options: {
    minCount?: number;
    maxCount?: number;
}, description: string): FilePatternResult;
/**
 * 検証結果をマージする
 */
export declare function mergeResults(...results: DocValidationResult[]): DocValidationResult;
/**
 * ファイル内容を読み込む
 */
export declare function readFileContent(filePath: string): string | null;
//# sourceMappingURL=markdown-structure.d.ts.map