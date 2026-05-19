/**
 * details-html - コアHTML生成
 *
 * 詳細ページのメインHTML生成、JSDocセクション、テストセクションを提供する。
 */
import type { DetailsContext, DetailHTMLData, CategorizedTestCase, TestCoverageAnalysis } from "../commands/details-types.js";
/**
 * 詳細ページ HTML を生成
 */
export declare function generateDetailHTML(data: DetailHTMLData, ctx: DetailsContext): string;
/**
 * JSDocセクションのHTMLを生成
 */
export declare function generateJSDocSection(jsDoc: string, fallbackDescription: string): string;
/**
 * タグ名を日本語ラベルに変換
 */
export declare function getTagLabel(tagName: string): string;
/**
 * テストセクション HTML を生成
 */
export declare function generateTestSectionHTML(testCases: CategorizedTestCase[], analysis: TestCoverageAnalysis, _color: string): string;
//# sourceMappingURL=details-html.d.ts.map