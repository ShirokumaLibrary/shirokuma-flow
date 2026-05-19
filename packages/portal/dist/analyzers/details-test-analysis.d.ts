/**
 * details-test-analysis - テストケース分析
 *
 * 要素・モジュールに関連するテストケースを抽出し、
 * カテゴリ分類とカバレッジ分析を行う。
 */
import type { DetailsContext, TestCategory, CategorizedTestCase, TestCoverageAnalysis } from "../commands/details-types.js";
/**
 * 要素に関連するテストケースを抽出
 */
export declare function findTestCasesForElement(elementName: string, elementPath: string, ctx: DetailsContext): CategorizedTestCase[];
/**
 * テスト名からカテゴリを推定
 */
export declare function categorizeTest(testName: string, describePath: string): {
    category: TestCategory;
    summary: string;
};
/**
 * テスト名から意図を抽出
 */
export declare function extractTestIntent(testName: string): string;
/**
 * テストカバレッジを分析
 */
export declare function analyzeTestCoverage(testCases: CategorizedTestCase[], hasAuth?: boolean, hasDb?: boolean): TestCoverageAnalysis;
/**
 * モジュールに関連するテストケースを抽出
 */
export declare function findTestCasesForModule(moduleName: string, type: string, ctx: DetailsContext): CategorizedTestCase[];
//# sourceMappingURL=details-test-analysis.d.ts.map