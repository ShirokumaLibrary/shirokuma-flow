/**
 * test-cases コマンド - テストケース一覧生成
 *
 * Jest と Playwright のテストケースを抽出し、HTML/Markdown で出力する
 */
import { resolve, relative } from "node:path";
import { loadConfig, getOutputPath, resolvePath } from "../utils/config.js";
import { ensureDir, writeFile, findFiles, fileExists, readFile } from "../utils/file.js";
import { createLogger } from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import { extractTestCases } from "../parsers/test-annotations.js";
import { extractFileDocComment } from "../parsers/test-annotations.js";
import { inferCategoryFromTestName, computeCategoryStats, inferModuleFromPath, createSummary, } from "../parsers/test-categorization.js";
import { generateMarkdown } from "../generators/test-cases-main.js";
import { generateCategoryListPage, generateHierarchicalPages } from "../generators/test-cases-hierarchy.js";
// ============================================================
// Command Handler
// ============================================================
/**
 * test-cases コマンドハンドラ
 */
export async function testCasesCommand(options) {
    const logger = createLogger(options.verbose);
    const projectPath = resolve(options.project);
    logger.info(t("commands.testCases.generating"));
    // 設定読み込み
    const config = loadConfig(projectPath, options.config);
    const testConfig = config.testCases;
    // 出力ディレクトリ
    const outputDir = options.output
        || testConfig?.output
        || getOutputPath(config, projectPath, "generated");
    const portalDir = getOutputPath(config, projectPath, "portal");
    ensureDir(outputDir);
    ensureDir(portalDir);
    // テストファイルを収集
    const jestFiles = await collectJestFiles(projectPath, testConfig?.jest);
    const playwrightFiles = await collectPlaywrightFiles(projectPath, testConfig?.playwright);
    logger.debug(`Jest テストファイル数: ${jestFiles.length}`);
    logger.debug(`Playwright テストファイル数: ${playwrightFiles.length}`);
    if (jestFiles.length === 0 && playwrightFiles.length === 0) {
        logger.warn(t("commands.testCases.noTestFiles"));
        return 0;
    }
    // テストケースを抽出
    const allTestCases = [];
    const fileStats = [];
    // Jest テストを抽出
    for (const file of jestFiles) {
        const content = readFile(file);
        if (!content)
            continue;
        const relativePath = relative(projectPath, file);
        const fileDoc = extractFileDocComment(content);
        const cases = extractTestCases(content, relativePath, "jest");
        // ファイルレベルの @app をテストケースに伝播
        if (fileDoc?.app) {
            for (const c of cases) {
                if (!c.app) {
                    c.app = fileDoc.app;
                }
            }
        }
        allTestCases.push(...cases);
        const describes = new Set(cases.map((c) => c.describe)).size;
        const module = inferModuleFromPath(relativePath, "jest");
        const categoryStats = computeCategoryStats(cases);
        fileStats.push({
            file: relativePath,
            framework: "jest",
            describes,
            tests: cases.length,
            module,
            fileDoc: fileDoc || undefined,
            categoryStats,
        });
    }
    // Playwright テストを抽出
    for (const file of playwrightFiles) {
        const content = readFile(file);
        if (!content)
            continue;
        const relativePath = relative(projectPath, file);
        const fileDoc = extractFileDocComment(content);
        const cases = extractTestCases(content, relativePath, "playwright");
        // ファイルレベルの @app をテストケースに伝播
        if (fileDoc?.app) {
            for (const c of cases) {
                if (!c.app) {
                    c.app = fileDoc.app;
                }
            }
        }
        allTestCases.push(...cases);
        const describes = new Set(cases.map((c) => c.describe)).size;
        const module = inferModuleFromPath(relativePath, "playwright");
        const categoryStats = computeCategoryStats(cases);
        fileStats.push({
            file: relativePath,
            framework: "playwright",
            describes,
            tests: cases.length,
            module,
            fileDoc: fileDoc || undefined,
            categoryStats,
        });
    }
    // 統計サマリーを作成
    const summary = createSummary(fileStats, allTestCases);
    logger.debug(`総テストケース数: ${summary.totalTests}`);
    logger.debug(`  Jest: ${summary.jestTests} tests in ${summary.jestFiles} files`);
    logger.debug(`  Playwright: ${summary.playwrightTests} tests in ${summary.playwrightFiles} files`);
    // Markdown 出力
    const mdPath = resolve(outputDir, "test-cases.md");
    const mdContent = generateMarkdown(allTestCases, summary, projectPath);
    writeFile(mdPath, mdContent);
    logger.success(`Markdown: ${mdPath}`);
    // 3階層 HTML 出力
    const testCasesDir = resolve(portalDir, "test-cases");
    ensureDir(testCasesDir);
    // 1. カテゴリ一覧ページ (test-cases.html)
    const categoryPagePath = resolve(portalDir, "test-cases.html");
    const categoryPageContent = generateCategoryListPage(allTestCases, summary, config.project.name);
    writeFile(categoryPagePath, categoryPageContent);
    logger.success(`HTML (カテゴリ一覧): ${categoryPagePath}`);
    // 2. ファイル一覧ページ (test-cases/{category}.html)
    // 3. テスト詳細ページ (test-cases/{category}/{file}.html)
    const generatedPages = generateHierarchicalPages(allTestCases, summary, config.project.name, testCasesDir);
    logger.success(`HTML (ファイル一覧): ${generatedPages.categoryPages} ページ`);
    logger.success(`HTML (テスト詳細): ${generatedPages.detailPages} ページ`);
    // JSON 出力 (他ツール連携用)
    // categoryが未設定のテストケースには推論したカテゴリを設定
    const testCasesWithCategory = allTestCases.map((tc) => ({
        ...tc,
        category: tc.category || inferCategoryFromTestName(tc.it, tc.description),
    }));
    const jsonPath = resolve(portalDir, "test-cases.json");
    const jsonContent = JSON.stringify({
        testCases: testCasesWithCategory,
        summary,
        generatedAt: new Date().toISOString(),
    }, null, 2);
    writeFile(jsonPath, jsonContent);
    logger.success(`JSON: ${jsonPath}`);
    logger.success(t("commands.testCases.done"));
    return 0;
}
// ============================================================
// File Collection (kept here for backward compatibility)
// ============================================================
/**
 * Jest テストファイルを収集
 */
export async function collectJestFiles(projectPath, jestConfig) {
    const testMatch = jestConfig?.testMatch || [
        "**/__tests__/**/*.test.{ts,tsx}",
        "**/__tests__/**/*.spec.{ts,tsx}",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
    ];
    const allFiles = [];
    for (const pattern of testMatch) {
        const files = await findFiles(projectPath, pattern, {
            ignore: [
                "**/node_modules/**",
                "**/dist/**",
                "**/.next/**",
                "**/tests/e2e/**", // Playwright ディレクトリを除外
            ],
        });
        allFiles.push(...files);
    }
    // 重複を除去
    return [...new Set(allFiles)];
}
/**
 * Playwright テストファイルを収集
 */
export async function collectPlaywrightFiles(projectPath, playwrightConfig) {
    const testDir = playwrightConfig?.testDir || "./tests/e2e";
    const testPath = resolvePath(projectPath, testDir);
    if (!fileExists(testPath)) {
        return [];
    }
    const files = await findFiles(testPath, "**/*.{test,spec}.{ts,tsx,js}", {
        ignore: ["**/node_modules/**"],
    });
    return files;
}
//# sourceMappingURL=test-cases.js.map