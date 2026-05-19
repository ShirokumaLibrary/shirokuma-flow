/**
 * testdoc-required ルール
 *
 * テストケースに @testdoc コメントがあるかチェック
 */
export const testdocRequiredRule = {
    id: "testdoc-required",
    severity: "warning",
    description: "Tests should have @testdoc comment",
    check(testCase, _allTestCases) {
        const issues = [];
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
//# sourceMappingURL=testdoc-required.js.map