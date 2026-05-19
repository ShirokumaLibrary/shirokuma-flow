/**
 * testdoc-min-length ルール
 *
 * @testdoc が最小文字数（10文字）以上かチェック
 */
const MIN_LENGTH = 10;
export const testdocMinLengthRule = {
    id: "testdoc-min-length",
    severity: "info",
    description: `@testdoc should be at least ${MIN_LENGTH} characters`,
    check(testCase, _allTestCases) {
        const issues = [];
        // @testdoc がない場合、または空の場合はスキップ（testdoc-required の責務）
        if (!testCase.description || testCase.description.trim() === "") {
            return issues;
        }
        // 最小文字数未満の場合
        if (testCase.description.length < MIN_LENGTH) {
            issues.push({
                rule: this.id,
                severity: this.severity,
                message: `@testdoc should be at least ${MIN_LENGTH} characters (current: ${testCase.description.length})`,
                file: testCase.file,
                line: testCase.line,
                testName: testCase.it,
            });
        }
        return issues;
    },
};
//# sourceMappingURL=testdoc-min-length.js.map