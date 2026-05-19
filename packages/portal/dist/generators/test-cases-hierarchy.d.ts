/**
 * test-cases 階層 HTML 生成
 *
 * 3階層構造のテストケースページを生成する:
 * 1. カテゴリ一覧 (test-cases.html)
 * 2. ファイル一覧 (test-cases/{category}.html)
 * 3. テスト詳細 (test-cases/{category}/{file}.html)
 */
import type { TestCase, TestSummary } from "../commands/test-cases-types.js";
/**
 * カテゴリ一覧ページを生成 (test-cases.html)
 */
export declare function generateCategoryListPage(testCases: TestCase[], summary: TestSummary, projectName: string): string;
/**
 * 階層的なページを生成
 */
export declare function generateHierarchicalPages(testCases: TestCase[], summary: TestSummary, projectName: string, outputDir: string): {
    categoryPages: number;
    detailPages: number;
};
//# sourceMappingURL=test-cases-hierarchy.d.ts.map