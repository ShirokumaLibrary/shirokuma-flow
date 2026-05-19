/**
 * test-cases メイン HTML 生成
 *
 * Markdown、サイドバー付き単一ページ HTML、
 * サマリーカードを生成する。
 */
import type { TestCase, TestSummary } from "../commands/test-cases-types.js";
/**
 * Markdown 生成
 */
export declare function generateMarkdown(testCases: TestCase[], summary: TestSummary, _projectPath: string): string;
/**
 * HTML 生成 (サイドバー付き)
 */
export declare function generateHtml(testCases: TestCase[], summary: TestSummary, projectName: string): string;
/**
 * サマリーカード HTML を生成
 */
export declare function buildSummaryCard(summary: TestSummary): string;
//# sourceMappingURL=test-cases-main.d.ts.map