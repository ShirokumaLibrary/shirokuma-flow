/**
 * testdoc-japanese ルール
 *
 * @testdoc に日本語が含まれているかチェック
 */
import { containsJapanese } from "../types.js";
export const testdocJapaneseRule = {
    id: "testdoc-japanese",
    severity: "warning",
    description: "@testdoc should contain Japanese characters",
    check(testCase, _allTestCases) {
        const issues = [];
        // @testdoc がない場合はスキップ（testdoc-required の責務）
        if (!testCase.description) {
            return issues;
        }
        // 日本語が含まれていない場合
        if (!containsJapanese(testCase.description)) {
            issues.push({
                rule: this.id,
                severity: this.severity,
                message: `@testdoc should contain Japanese characters for better readability`,
                file: testCase.file,
                line: testCase.line,
                testName: testCase.it,
            });
        }
        return issues;
    },
};
//# sourceMappingURL=testdoc-japanese.js.map