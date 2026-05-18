/**
 * describe-coverage ルール
 *
 * describe ブロック単位でのカバレッジを報告
 */

import type { LintRule, LintIssue, TestCaseForLint } from "../types.js";

export const describeCoverageRule: LintRule = {
  id: "describe-coverage",
  severity: "info",
  description: "Report @testdoc coverage per describe block",

  check(testCase: TestCaseForLint, allTestCases: TestCaseForLint[]): LintIssue[] {
    const issues: LintIssue[] = [];

    // 同じファイル・同じ describe ブロックのテストケースを取得
    const describeTests = allTestCases.filter(
      (tc) => tc.file === testCase.file && tc.describe === testCase.describe
    );

    // この describe ブロックの最初のテストケースでのみチェック
    const firstInDescribe = describeTests[0];
    if (!isSameTestCase(firstInDescribe, testCase)) {
      return issues;
    }

    // カバレッジを計算
    const totalTests = describeTests.length;
    const testsWithTestdoc = describeTests.filter((tc) => tc.description).length;
    const coverage = totalTests > 0 ? Math.round((testsWithTestdoc / totalTests) * 100) : 0;

    // 100% 未満の場合は報告
    if (coverage < 100) {
      issues.push({
        rule: this.id,
        severity: this.severity,
        message: `describe "${testCase.describe}": ${coverage}% coverage (${testsWithTestdoc}/${totalTests} tests with @testdoc)`,
        file: testCase.file,
        line: testCase.line,
        testName: testCase.describe, // describe 名を使用
      });
    }

    return issues;
  },
};

/**
 * 同じテストケースかどうか判定
 */
function isSameTestCase(a: TestCaseForLint, b: TestCaseForLint): boolean {
  return a.file === b.file && a.line === b.line && a.it === b.it;
}
