/**
 * Lint メインロジック
 *
 * テストケースのlintを実行する
 */
import { getEnabledRules } from "./rules/index.js";
/**
 * テストケースをlintする
 *
 * @param testCases テストケース配列
 * @param options Lintオプション
 * @returns Lintレポート
 */
export function runLint(testCases, options) {
    // 有効なルールを取得
    const enabledRules = getEnabledRules(options.enabledRules);
    // ファイル別にグループ化
    const fileGroups = groupByFile(testCases);
    // ファイル別の結果を収集
    const results = [];
    const allIssues = [];
    for (const [file, cases] of fileGroups) {
        const framework = cases[0]?.framework || "jest";
        const fileIssues = [];
        // 各テストケースに対してルールをチェック
        for (const testCase of cases) {
            for (const rule of enabledRules) {
                const issues = rule.check(testCase, testCases);
                fileIssues.push(...issues);
            }
        }
        // @testdoc があるテスト数をカウント
        const testsWithTestdoc = cases.filter((tc) => tc.description).length;
        results.push({
            file,
            framework,
            totalTests: cases.length,
            testsWithTestdoc,
            issues: fileIssues,
        });
        allIssues.push(...fileIssues);
    }
    // Issue カウントを計算
    const errorCount = allIssues.filter((i) => i.severity === "error").length;
    const warningCount = allIssues.filter((i) => i.severity === "warning").length;
    const infoCount = allIssues.filter((i) => i.severity === "info").length;
    // カバレッジを計算
    const totalTests = testCases.length;
    const testsWithTestdoc = testCases.filter((tc) => tc.description).length;
    const coverage = totalTests > 0 ? Math.round((testsWithTestdoc / totalTests) * 100) : 0;
    // 合格判定
    const passed = isPassed(options, errorCount, warningCount, coverage);
    return {
        results,
        summary: {
            totalFiles: fileGroups.size,
            totalTests,
            testsWithTestdoc,
            coverage,
            errorCount,
            warningCount,
            infoCount,
        },
        passed,
    };
}
/**
 * ファイル別にグループ化
 */
function groupByFile(testCases) {
    const map = new Map();
    for (const testCase of testCases) {
        const existing = map.get(testCase.file) || [];
        existing.push(testCase);
        map.set(testCase.file, existing);
    }
    return map;
}
/**
 * 合格判定
 */
function isPassed(options, errorCount, warningCount, coverage) {
    // エラーがあれば失敗
    if (errorCount > 0) {
        return false;
    }
    // strictモードでは警告があれば失敗
    if (options.strict && warningCount > 0) {
        return false;
    }
    // カバレッジ閾値を下回ったら失敗
    if (coverage < options.coverageThreshold) {
        return false;
    }
    return true;
}
// 型のエクスポート
export * from "./types.js";
// ルールのエクスポート
export * from "./rules/index.js";
// フォーマッターのエクスポート
export * from "./formatters/index.js";
//# sourceMappingURL=index.js.map