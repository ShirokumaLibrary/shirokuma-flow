/**
 * details-test-analysis - テストケース分析
 *
 * 要素・モジュールに関連するテストケースを抽出し、
 * カテゴリ分類とカバレッジ分析を行う。
 */
import { escapeRegExp } from "../utils/sanitize.js";
/**
 * 要素に関連するテストケースを抽出
 */
export function findTestCasesForElement(elementName, elementPath, ctx) {
    const results = [];
    const lowerName = elementName.toLowerCase();
    for (const tc of ctx.allTestCases) {
        const descLower = tc.describe.toLowerCase();
        const fileLower = tc.file.toLowerCase();
        const isRelevant = descLower.includes(lowerName) ||
            lowerName.includes(descLower.split(" > ")[0]) ||
            fileLower.includes(lowerName.replace(/([A-Z])/g, "-$1").toLowerCase());
        if (isRelevant) {
            const { category, summary } = categorizeTest(tc.it, tc.describe);
            results.push({
                ...tc,
                category,
                summary: tc.description || summary,
            });
        }
    }
    return results;
}
/**
 * テスト名からカテゴリを推定
 */
export function categorizeTest(testName, describePath) {
    const combined = `${describePath.toLowerCase()} ${testName.toLowerCase()}`;
    // 認証・認可系
    if (/auth|login|logout|session|permission|role|unauthorized|forbidden|credential|token/.test(combined)) {
        return { category: "auth", summary: extractTestIntent(testName) };
    }
    // エラーハンドリング系
    if (/throw|error|fail|reject|invalid|exception|catch|not found|404|500/.test(combined)) {
        if (/valid|schema|required|min|max|format/.test(combined)) {
            return { category: "validation", summary: extractTestIntent(testName) };
        }
        return { category: "error-handling", summary: extractTestIntent(testName) };
    }
    // バリデーション系
    if (/valid|schema|required|min|max|format|type|constraint|sanitize/.test(combined)) {
        return { category: "validation", summary: extractTestIntent(testName) };
    }
    // 境界値・エッジケース系
    if (/empty|null|undefined|zero|boundary|edge|limit|overflow|special|unicode/.test(combined)) {
        return { category: "edge-case", summary: extractTestIntent(testName) };
    }
    // 統合テスト系
    if (/integration|e2e|end.to.end|workflow|scenario/.test(combined)) {
        return { category: "integration", summary: extractTestIntent(testName) };
    }
    // 正常系（デフォルト）
    if (/should|return|create|update|delete|get|fetch|render|display|show/.test(combined)) {
        return { category: "happy-path", summary: extractTestIntent(testName) };
    }
    return { category: "other", summary: extractTestIntent(testName) };
}
/**
 * テスト名から意図を抽出
 */
export function extractTestIntent(testName) {
    const shouldMatch = testName.match(/should\s+(.+?)(?:\s+when\s+(.+))?$/i);
    if (shouldMatch) {
        const action = shouldMatch[1];
        const condition = shouldMatch[2];
        return condition ? `${action}（${condition}の場合）` : action;
    }
    return testName;
}
/**
 * テストカバレッジを分析
 */
export function analyzeTestCoverage(testCases, hasAuth = false, hasDb = false) {
    const byCategory = {
        "happy-path": [],
        "error-handling": [],
        auth: [],
        validation: [],
        "edge-case": [],
        integration: [],
        other: [],
    };
    for (const tc of testCases) {
        byCategory[tc.category].push(tc);
    }
    const missingPatterns = [];
    const recommendations = [];
    if (byCategory["happy-path"].length === 0) {
        missingPatterns.push("正常系テスト");
        recommendations.push("基本的な正常系テストを追加してください");
    }
    if (byCategory["error-handling"].length === 0) {
        missingPatterns.push("エラーハンドリングテスト");
        recommendations.push("エラー発生時の挙動をテストしてください");
    }
    if (hasAuth && byCategory.auth.length === 0) {
        missingPatterns.push("認証・認可テスト");
        recommendations.push("未認証/権限不足時のテストを追加してください");
    }
    if (hasDb && byCategory["edge-case"].length === 0) {
        missingPatterns.push("境界値テスト");
        recommendations.push("空データ、存在しないID等のエッジケースをテストしてください");
    }
    // スコア計算
    let score = 0;
    const weights = {
        "happy-path": 30,
        "error-handling": 25,
        auth: hasAuth ? 20 : 0,
        validation: 15,
        "edge-case": 10,
        integration: 5,
        other: 0,
    };
    for (const [cat, weight] of Object.entries(weights)) {
        if (byCategory[cat].length > 0) {
            score += weight;
        }
    }
    if (testCases.length >= 5)
        score = Math.min(score + 10, 100);
    if (testCases.length >= 10)
        score = Math.min(score + 10, 100);
    return {
        totalTests: testCases.length,
        byCategory,
        missingPatterns,
        coverageScore: score,
        recommendations,
    };
}
/**
 * モジュールに関連するテストケースを抽出
 */
export function findTestCasesForModule(moduleName, type, ctx) {
    const results = [];
    const lowerName = moduleName.toLowerCase();
    const pathPatterns = [];
    const escaped = escapeRegExp(lowerName);
    switch (type) {
        case "action":
            pathPatterns.push(new RegExp(`/lib/actions/${escaped}\\.test\\.ts$`, "i"), new RegExp(`/__tests__/lib/actions/${escaped}\\.test\\.ts$`, "i"), new RegExp(`/actions/${escaped}\\.test\\.ts$`, "i"));
            break;
        case "component":
            pathPatterns.push(new RegExp(`/components/${escaped}\\.test\\.tsx?$`, "i"), new RegExp(`/__tests__/components/${escaped}\\.test\\.tsx?$`, "i"), new RegExp(`/components/.*${escaped}.*\\.test\\.tsx?$`, "i"));
            break;
        case "screen":
            pathPatterns.push(new RegExp(`/e2e/${escaped}\\.spec\\.ts$`, "i"), new RegExp(`/${escaped}\\.spec\\.ts$`, "i"));
            break;
        default:
            break;
    }
    for (const tc of ctx.allTestCases) {
        const matchesPath = pathPatterns.some((pattern) => pattern.test(tc.file));
        const matchesDescribe = tc.describe.toLowerCase().includes(lowerName);
        if (matchesPath || matchesDescribe) {
            const { category, summary } = categorizeTest(tc.it, tc.describe);
            results.push({
                ...tc,
                category,
                summary: tc.description || summary,
            });
        }
    }
    return results;
}
//# sourceMappingURL=details-test-analysis.js.map