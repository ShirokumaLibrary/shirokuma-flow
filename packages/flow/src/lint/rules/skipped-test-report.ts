/**
 * skipped-test-report ルール
 *
 * スキップされているテスト（it.skip / test.skip）を検出して報告する。
 * @skip-reason アノテーションがあればその理由も表示。
 *
 * 重大度: info（情報提供のみ、エラーではない）
 */

import type { LintRule, LintIssue, TestCaseForLint } from "../types.js";

export const skippedTestReportRule: LintRule = {
  id: "skipped-test-report",
  severity: "info",
  description: "Reports skipped tests (it.skip / test.skip) for visibility",

  check(testCase: TestCaseForLint, _allTestCases: TestCaseForLint[]): LintIssue[] {
    const issues: LintIssue[] = [];

    if (testCase.skipped) {
      const reasonPart = testCase.skipReason
        ? ` - Reason: ${testCase.skipReason}`
        : " (no @skip-reason provided)";

      issues.push({
        rule: this.id,
        severity: this.severity,
        message: `Skipped test detected${reasonPart}`,
        file: testCase.file,
        line: testCase.line,
        testName: testCase.it,
      });
    }

    return issues;
  },
};
