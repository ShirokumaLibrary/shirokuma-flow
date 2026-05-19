/**
 * ポータルデータプロセッサー
 *
 * JSON ファイル + overview.md を読み込んで PortalData オブジェクトを返す。
 * portal/lib/data-loader.ts の Node.js 移植版。
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
/**
 * JSON ファイルを読み込んで解析する
 */
function readJsonFile(dataDir, filename) {
    const filePath = join(dataDir, filename);
    if (!existsSync(filePath))
        return null;
    try {
        const content = readFileSync(filePath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
/**
 * overview.md を読み込む
 */
function loadOverview(projectPath, dataDir) {
    const possiblePaths = [
        join(projectPath, "docs", "OVERVIEW.md"),
        join(projectPath, "OVERVIEW.md"),
        join(projectPath, "README.md"),
        join(dataDir, "overview.md"),
    ];
    for (const filePath of possiblePaths) {
        if (existsSync(filePath)) {
            try {
                const content = readFileSync(filePath, "utf-8");
                return { content };
            }
            catch {
                // 次のパスを試す
            }
        }
    }
    return null;
}
/**
 * 利用可能データから applications データを自動生成する
 */
function autoGenerateApplications(featureMap, testCases, dbSchema, apiTools, available) {
    const webStats = {
        screens: 0,
        components: 0,
        actions: 0,
        tests: 0,
    };
    if (featureMap) {
        for (const group of Object.values(featureMap.features)) {
            webStats.screens += group.screens?.length || 0;
            webStats.components += group.components?.length || 0;
            webStats.actions += group.actions?.length || 0;
        }
        webStats.screens += featureMap.uncategorized.screens?.length || 0;
        webStats.components += featureMap.uncategorized.components?.length || 0;
        webStats.actions += featureMap.uncategorized.actions?.length || 0;
    }
    if (testCases) {
        const mcpTestCount = testCases.testCases.filter((t) => t.file.includes("/mcp/") || t.file.includes("apps/mcp/")).length;
        webStats.tests = testCases.summary.totalTests - mcpTestCount;
    }
    const mcpStats = {
        tools: apiTools?.summary?.totalTools || apiTools?.tools?.length || 0,
        tests: testCases?.testCases.filter((t) => t.file.includes("/mcp/") || t.file.includes("apps/mcp/")).length || 0,
    };
    const apps = [];
    if (available.hasFeatureMap) {
        apps.push({
            id: "web",
            name: "Web アプリ",
            description: "メインアプリケーション",
            type: "web",
            icon: "globe",
            color: "blue",
            source: "apps/web",
            stats: webStats,
            sections: [
                { type: "featureMap", label: "機能マップ", icon: "layers", available: true },
            ],
        });
    }
    if (available.hasApiTools) {
        const apiProtocol = apiTools?.protocol || "mcp";
        const apiName = apiTools?.name || "API Server";
        const apiDescription = apiTools?.description || "API ツール一覧";
        apps.push({
            id: "mcp",
            name: apiName,
            description: apiDescription,
            type: "api",
            protocol: apiProtocol,
            icon: "bot",
            color: "purple",
            source: "apps/mcp",
            stats: mcpStats,
            sections: [
                {
                    type: "tools",
                    label: "ツール一覧",
                    icon: "wrench",
                    available: true,
                    count: mcpStats.tools,
                },
            ],
        });
    }
    const totalTests = testCases?.summary.totalTests || 0;
    return {
        shared: {
            sections: [
                {
                    type: "overview",
                    label: "プロジェクト概要",
                    icon: "file-text",
                    available: available.hasOverview,
                },
                {
                    type: "dbSchema",
                    label: "データベーススキーマ",
                    icon: "database",
                    available: available.hasDbSchema,
                    count: dbSchema?.tables.length,
                },
                {
                    type: "testCases",
                    label: "テストケース",
                    icon: "check-circle",
                    available: available.hasTestCases,
                    count: totalTests,
                },
            ],
        },
        apps,
    };
}
/**
 * 出力ディレクトリから全ポータルデータを読み込む
 *
 * @param outputDir - JSON ファイルが格納されているディレクトリ
 * @param projectName - プロジェクト名
 * @param projectPath - プロジェクトルートパス（overview.md の探索に使用）
 * @returns PortalData オブジェクト
 */
export function loadPortalData(outputDir, projectName, projectPath) {
    const dataDir = resolve(outputDir);
    const featureMap = readJsonFile(dataDir, "feature-map.json");
    const testCases = readJsonFile(dataDir, "test-cases.json");
    const dbSchema = readJsonFile(dataDir, "db-schema.json");
    const details = readJsonFile(dataDir, "details.json");
    const i18n = readJsonFile(dataDir, "i18n.json");
    const packages = readJsonFile(dataDir, "packages.json");
    const apiTools = readJsonFile(dataDir, "api-tools.json");
    const coverage = readJsonFile(dataDir, "coverage.json");
    const githubData = readJsonFile(dataDir, "github-data.json");
    const overview = loadOverview(projectPath, dataDir);
    const available = {
        hasFeatureMap: featureMap !== null,
        hasTestCases: testCases !== null,
        hasDbSchema: dbSchema !== null,
        hasDetails: details !== null,
        hasApplications: false, // 後で更新
        hasI18n: i18n !== null,
        hasPackages: packages !== null,
        hasApiTools: apiTools !== null,
        hasOverview: overview !== null,
        hasGithubData: githubData !== null,
    };
    // applications.json を試み、なければ自動生成
    let applications = readJsonFile(dataDir, "applications.json");
    if (!applications) {
        applications = autoGenerateApplications(featureMap, testCases, dbSchema, apiTools, available);
    }
    available.hasApplications = applications !== null;
    return {
        projectName,
        featureMap,
        testCases,
        dbSchema,
        details,
        applications,
        i18n,
        packages,
        apiTools,
        coverage,
        overview,
        githubData,
        available,
    };
}
//# sourceMappingURL=data-processor.js.map