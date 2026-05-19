/**
 * test-annotations - テストアノテーション解析
 *
 * テストファイルからテストケース、JSDocコメント、BDDアノテーションを抽出する。
 */
import type { TestCase, TestDocComment, FileDocComment, TestCategory } from "../commands/generate/test-cases-types.js";
/**
 * テストファイルからテストケースを抽出
 *
 * ネストした describe ブロックを正しく追跡し、
 * 括弧のバランスで describe の終了を検出する
 */
export declare function extractTestCases(content: string, file: string, framework: "jest" | "playwright"): TestCase[];
/**
 * テストケース直前のJSDocコメントを抽出
 *
 * @param lines ファイルの全行
 * @param testLineIndex テストケースの行インデックス (0-indexed)
 * @returns コメント情報 または null
 */
export declare function extractTestDocComment(lines: string[], testLineIndex: number): TestDocComment | null;
/**
 * テストカテゴリをパース
 */
export declare function parseTestCategory(value: string): TestCategory;
/**
 * ファイルレベルのドキュメントコメントを抽出
 *
 * ファイル先頭の JSDoc コメントから @testFileDoc, @module, @coverage を抽出
 */
export declare function extractFileDocComment(content: string): FileDocComment | null;
/**
 * describe ブロックのドキュメントコメントを抽出 (@testGroupDoc 対応)
 */
export declare function extractDescribeDocComment(lines: string[], describeLineIndex: number): {
    testdoc?: string;
    purpose?: string;
    priority?: "high" | "medium" | "low";
} | null;
export { countBraces } from "../utils/brace-matching.js";
//# sourceMappingURL=test-annotations.d.ts.map