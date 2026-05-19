/**
 * Lint メインロジック
 *
 * テストケースのlintを実行する
 */
import type { LintReport, LintOptions, TestCaseForLint } from "./types.js";
/**
 * テストケースをlintする
 *
 * @param testCases テストケース配列
 * @param options Lintオプション
 * @returns Lintレポート
 */
export declare function runLint(testCases: TestCaseForLint[], options: LintOptions): LintReport;
export * from "./types.js";
export * from "./rules/index.js";
export * from "./formatters/index.js";
//# sourceMappingURL=index.d.ts.map