/**
 * duplicate-testdoc ルール
 *
 * @testdoc が重複していないかチェック
 */
export const duplicateTestdocRule = {
    id: "duplicate-testdoc",
    severity: "error",
    description: "No duplicate @testdoc descriptions",
    check(testCase, allTestCases) {
        const issues = [];
        // @testdoc がない場合はスキップ
        if (!testCase.description) {
            return issues;
        }
        // 同じ description を持つ他のテストケースを探す
        const firstOccurrence = allTestCases.find((tc) => tc.description === testCase.description);
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
function isSameTestCase(a, b) {
    return a.file === b.file && a.line === b.line && a.it === b.it;
}
//# sourceMappingURL=duplicate-testdoc.js.map