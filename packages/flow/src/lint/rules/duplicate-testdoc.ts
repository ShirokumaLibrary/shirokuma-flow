/**
 * duplicate-testdoc ルール
 *
 * @testdoc が重複していないかチェック
 */

import type { LintRule, LintIssue, TestCaseForLint } from "../types.js";

export const duplicateTestdocRule: LintRule = {
  id: "duplicate-testdoc",
  severity: "error",
  description: "No duplicate @testdoc descriptions",

  check(testCase: TestCaseForLint, allTestCases: TestCaseForLint[]): LintIssue[] {
    const issues: LintIssue[] = [];

    // @testdoc がない場合はスキップ
    if (!testCase.description) {
      return issues;
    }

    // 同じ description を持つ他のテストケースを探す
    const firstOccurrence = allTestCases.find(
      (tc) => tc.description === testCase.description
    );

    // このテストケースが最初の出現ではない場合はエラー
    if (firstOccurrence && !isSameTestCase(firstOccurrence, testCase)) {
      issues.push({
        rule: this.id,
        severity: this.severity,
        message: `Duplicate @testdoc: "${testCase.description}"`,
        file: testCase.file,
        line: testCase.line,
        testName: testCase.it,
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
