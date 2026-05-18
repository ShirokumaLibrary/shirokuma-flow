/**
 * testdoc-required ルール
 *
 * テストケースに @testdoc コメントがあるかチェック
 */

import type { LintRule, LintIssue, TestCaseForLint } from "../types.js";

export const testdocRequiredRule: LintRule = {
  id: "testdoc-required",
  severity: "warning",
  description: "Tests should have @testdoc comment",

  check(testCase: TestCaseForLint, _allTestCases: TestCaseForLint[]): LintIssue[] {
    const issues: LintIssue[] = [];

    // @testdoc がないか、空か、空白のみの場合
    const description = testCase.description?.trim();
    if (!description) {
      issues.push({
        rule: this.id,
        severity: this.severity,
        message: `Test is missing @testdoc comment`,
        file: testCase.file,
        line: testCase.line,
        testName: testCase.it,
      });
    }

    return issues;
  },
};
