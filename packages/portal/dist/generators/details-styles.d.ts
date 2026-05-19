/**
 * details-styles - CSS・スクリプト・URLユーティリティ
 *
 * 詳細ページ用のスタイル、スクリプト、テストページURLユーティリティを提供する。
 */
import type { TestCategory } from "../commands/details-types.js";
/**
 * テストファイルパスからtest-cases.htmlのアンカーIDを生成
 */
export declare function generateTestCaseAnchorId(file: string, framework: "jest" | "playwright"): string;
/**
 * テストファイルのカテゴリを判定
 */
export declare function getTestFileCategory(file: string, framework: "jest" | "playwright"): string;
/**
 * カテゴリからスラッグを生成
 */
export declare function testCategoryToSlug(category: string): string;
/**
 * テストファイル名からスラッグを生成
 */
export declare function testFileToSlug(file: string): string;
/**
 * テストファイルから3階層URL（相対パス）を生成
 */
export declare function generateTestPageUrl(file: string, framework: "jest" | "playwright", depth: number): string;
export declare const categoryLabels: Record<TestCategory, {
    label: string;
    icon: string;
    color: string;
}>;
/**
 * CDN スクリプトタグ + グローバルナビ
 */
export declare function getCdnScripts(): string;
export declare function getDetailScripts(): string;
export declare function getDetailStyles(accentColor: string): string;
export declare function getModuleSpecificStyles(accentColor: string): string;
//# sourceMappingURL=details-styles.d.ts.map