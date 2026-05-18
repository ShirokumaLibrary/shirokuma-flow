import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * データプロセッサーテスト
 *
 * @testdoc portal/data-processor.ts のテスト
 */


// =============================================================================
// Mocks
// =============================================================================

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock("node:fs", () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

const { loadPortalData } = await import(
  "../../src/generators/portal/data-processor.js"
);

// =============================================================================
// ヘルパー
// =============================================================================

/** 特定ファイル名を含むパスにだけ true を返す existsSync モック */
function existsFor(...filenames: string[]) {
  mockExistsSync.mockImplementation((p: unknown) => {
    const path = String(p);
    return filenames.some((f) => path.includes(f));
  });
}

/** ファイル名に応じた内容を返す readFileSync モック */
function readsAs(map: Record<string, string>) {
  mockReadFileSync.mockImplementation((p: unknown) => {
    const path = String(p);
    for (const [key, value] of Object.entries(map)) {
      if (path.includes(key)) return value;
    }
    throw new Error(`ENOENT: ${path}`);
  });
}

// =============================================================================
// テストデータ
// =============================================================================

const fakeFeatureMap = {
  features: {
    Auth: { screens: [{ name: "Login" }], components: [], actions: [], tables: [], modules: [] },
  },
  uncategorized: { screens: [], components: [], actions: [], tables: [], modules: [] },
  moduleDescriptions: {},
  moduleTypes: {},
  moduleUtilities: {},
  generatedAt: "2026-01-01",
};

const fakeTestCases = {
  testCases: [
    { file: "src/auth.test.ts", line: 10, describe: "Auth", it: "login", category: "unit" },
    { file: "apps/mcp/tools.test.ts", line: 5, describe: "MCP", it: "list", category: "unit" },
  ],
  summary: { totalTests: 2, totalFiles: 2 },
};

const fakeDbSchema = {
  tables: [
    { name: "users", columns: [{ name: "id", type: "integer" }], foreignKeys: [] },
    { name: "posts", columns: [{ name: "id", type: "integer" }], foreignKeys: [] },
  ],
  databases: [],
};

const fakeI18n = {
  namespaces: [{ name: "common", keys: ["hello"] }],
  summary: { totalKeys: 1, totalNamespaces: 1 },
};

const fakePackages = {
  packages: [{ name: "core", version: "1.0.0" }],
};

const fakeApiTools = {
  tools: [{ name: "search" }],
  summary: { totalTools: 1 },
  protocol: "mcp",
  name: "MCP Server",
  description: "MCP ツール",
};

const fakeCoverage = {
  summary: { totalFiles: 10, testedFiles: 8, coverage: 0.8 },
};

const fakeGithubData = {
  repository: { name: "test-repo" },
};

// =============================================================================
// Tests
// =============================================================================

describe("loadPortalData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 基本動作
  // ===========================================================================

  /**
   * @testdoc JSON ファイルが存在しない場合は null を返す
   */
  it("should return null fields when JSON files do not exist", () => {
    mockExistsSync.mockReturnValue(false);

    const result = loadPortalData("/output", "TestProject", "/project");

    expect(result.projectName).toBe("TestProject");
    expect(result.featureMap).toBeNull();
    expect(result.testCases).toBeNull();
    expect(result.dbSchema).toBeNull();
    expect(result.details).toBeNull();
    expect(result.i18n).toBeNull();
    expect(result.packages).toBeNull();
    expect(result.apiTools).toBeNull();
    expect(result.coverage).toBeNull();
    expect(result.githubData).toBeNull();
    expect(result.overview).toBeNull();
  });

  /**
   * @testdoc 全データが null の場合の available フラグが正しい
   */
  it("should set all available flags to false when no data", () => {
    mockExistsSync.mockReturnValue(false);

    const result = loadPortalData("/output", "TestProject", "/project");

    expect(result.available.hasFeatureMap).toBe(false);
    expect(result.available.hasTestCases).toBe(false);
    expect(result.available.hasDbSchema).toBe(false);
    expect(result.available.hasDetails).toBe(false);
    expect(result.available.hasI18n).toBe(false);
    expect(result.available.hasPackages).toBe(false);
    expect(result.available.hasApiTools).toBe(false);
    expect(result.available.hasOverview).toBe(false);
    expect(result.available.hasGithubData).toBe(false);
  });

  // ===========================================================================
  // 各データタイプの読み込み
  // ===========================================================================

  /**
   * @testdoc feature-map.json が存在する場合は読み込む
   */
  it("should load feature-map.json when it exists", () => {
    existsFor("feature-map.json");
    readsAs({ "feature-map.json": JSON.stringify(fakeFeatureMap) });

    const result = loadPortalData("/output", "MyProject", "/project");

    expect(result.featureMap).not.toBeNull();
    expect(result.available.hasFeatureMap).toBe(true);
    expect(result.featureMap?.features).toHaveProperty("Auth");
  });

  /**
   * @testdoc test-cases.json が存在する場合は読み込む
   */
  it("should load test-cases.json when it exists", () => {
    existsFor("test-cases.json");
    readsAs({ "test-cases.json": JSON.stringify(fakeTestCases) });

    const result = loadPortalData("/output", "MyProject", "/project");

    expect(result.testCases).not.toBeNull();
    expect(result.available.hasTestCases).toBe(true);
    expect(result.testCases?.testCases).toHaveLength(2);
  });

  /**
   * @testdoc db-schema.json が存在する場合は読み込む
   */
  it("should load db-schema.json when it exists", () => {
    existsFor("db-schema.json");
    readsAs({ "db-schema.json": JSON.stringify(fakeDbSchema) });

    const result = loadPortalData("/output", "MyProject", "/project");

    expect(result.dbSchema).not.toBeNull();
    expect(result.available.hasDbSchema).toBe(true);
    expect(result.dbSchema?.tables).toHaveLength(2);
  });

  /**
   * @testdoc i18n.json が存在する場合は読み込む
   */
  it("should load i18n.json when it exists", () => {
    existsFor("i18n.json");
    readsAs({ "i18n.json": JSON.stringify(fakeI18n) });

    const result = loadPortalData("/output", "MyProject", "/project");

    expect(result.i18n).not.toBeNull();
    expect(result.available.hasI18n).toBe(true);
  });

  /**
   * @testdoc packages.json が存在する場合は読み込む
   */
  it("should load packages.json when it exists", () => {
    existsFor("packages.json");
    readsAs({ "packages.json": JSON.stringify(fakePackages) });

    const result = loadPortalData("/output", "MyProject", "/project");

    expect(result.packages).not.toBeNull();
    expect(result.available.hasPackages).toBe(true);
  });

  /**
   * @testdoc api-tools.json が存在する場合は読み込む
   */
  it("should load api-tools.json when it exists", () => {
    existsFor("api-tools.json");
    readsAs({ "api-tools.json": JSON.stringify(fakeApiTools) });

    const result = loadPortalData("/output", "MyProject", "/project");

    expect(result.apiTools).not.toBeNull();
    expect(result.available.hasApiTools).toBe(true);
  });

  /**
   * @testdoc coverage.json が存在する場合は読み込む
   */
  it("should load coverage.json when it exists", () => {
    existsFor("coverage.json");
    readsAs({ "coverage.json": JSON.stringify(fakeCoverage) });

    const result = loadPortalData("/output", "MyProject", "/project");

    expect(result.coverage).not.toBeNull();
  });

  /**
   * @testdoc github-data.json が存在する場合は読み込む
   */
  it("should load github-data.json when it exists", () => {
    existsFor("github-data.json");
    readsAs({ "github-data.json": JSON.stringify(fakeGithubData) });

    const result = loadPortalData("/output", "MyProject", "/project");

    expect(result.githubData).not.toBeNull();
    expect(result.available.hasGithubData).toBe(true);
  });

  // ===========================================================================
  // overview 読み込みフォールバック
  // ===========================================================================

  /**
   * @testdoc overview.md がプロジェクトルートに存在する場合は読み込む
   */
  it("should load overview.md from project root", () => {
    existsFor("OVERVIEW.md");
    readsAs({ "OVERVIEW.md": "# My Project\n\nOverview content." });

    const result = loadPortalData("/output", "MyProject", "/project");

    expect(result.overview).not.toBeNull();
    expect(result.overview?.content).toContain("# My Project");
    expect(result.available.hasOverview).toBe(true);
  });

  /**
   * @testdoc OVERVIEW.md がなく README.md がある場合はフォールバックする
   */
  it("should fall back to README.md when OVERVIEW.md does not exist", () => {
    existsFor("README.md");
    readsAs({ "README.md": "# README content" });

    const result = loadPortalData("/output", "MyProject", "/project");

    expect(result.overview).not.toBeNull();
    expect(result.overview?.content).toContain("README content");
  });

  // ===========================================================================
  // エラーハンドリング
  // ===========================================================================

  /**
   * @testdoc JSON パースエラーの場合は null を返す
   */
  it("should return null when JSON is malformed", () => {
    existsFor("feature-map.json");
    readsAs({ "feature-map.json": "{ invalid json }" });

    const result = loadPortalData("/output", "MyProject", "/project");

    expect(result.featureMap).toBeNull();
    expect(result.available.hasFeatureMap).toBe(false);
  });

  // ===========================================================================
  // applications 自動生成
  // ===========================================================================

  /**
   * @testdoc applications.json が存在しない場合は自動生成する
   */
  it("should auto-generate applications when applications.json is missing", () => {
    mockExistsSync.mockReturnValue(false);

    const result = loadPortalData("/output", "MyProject", "/project");

    expect(result.applications).not.toBeNull();
    expect(result.applications?.shared.sections).toBeDefined();
  });

  /**
   * @testdoc featureMap がある場合は Web アプリを自動生成する
   */
  it("should auto-generate Web app when featureMap exists", () => {
    existsFor("feature-map.json");
    readsAs({ "feature-map.json": JSON.stringify(fakeFeatureMap) });

    const result = loadPortalData("/output", "MyProject", "/project");

    const webApp = result.applications?.apps.find((a) => a.id === "web");
    expect(webApp).toBeDefined();
    expect(webApp?.name).toBe("Web アプリ");
    expect(webApp?.stats?.screens).toBe(1); // Auth.screens[Login]
  });

  /**
   * @testdoc apiTools がある場合は MCP アプリを自動生成する
   */
  it("should auto-generate MCP app when apiTools exists", () => {
    existsFor("api-tools.json");
    readsAs({ "api-tools.json": JSON.stringify(fakeApiTools) });

    const result = loadPortalData("/output", "MyProject", "/project");

    const mcpApp = result.applications?.apps.find((a) => a.id === "mcp");
    expect(mcpApp).toBeDefined();
    expect(mcpApp?.name).toBe("MCP Server");
    expect(mcpApp?.stats?.tools).toBe(1);
  });

  /**
   * @testdoc testCases から Web/MCP のテスト数を分離カウントする
   */
  it("should separate test counts between Web and MCP", () => {
    existsFor("feature-map.json", "test-cases.json", "api-tools.json");
    readsAs({
      "feature-map.json": JSON.stringify(fakeFeatureMap),
      "test-cases.json": JSON.stringify(fakeTestCases),
      "api-tools.json": JSON.stringify(fakeApiTools),
    });

    const result = loadPortalData("/output", "MyProject", "/project");

    const webApp = result.applications?.apps.find((a) => a.id === "web");
    const mcpApp = result.applications?.apps.find((a) => a.id === "mcp");
    // total 2 tests: 1 in auth (web), 1 in apps/mcp (mcp)
    expect(webApp?.stats?.tests).toBe(1);
    expect(mcpApp?.stats?.tests).toBe(1);
  });

  /**
   * @testdoc dbSchema がある場合は shared sections にテーブル数を含む
   */
  it("should include table count in shared sections when dbSchema exists", () => {
    existsFor("db-schema.json");
    readsAs({ "db-schema.json": JSON.stringify(fakeDbSchema) });

    const result = loadPortalData("/output", "MyProject", "/project");

    const dbSection = result.applications?.shared.sections.find((s) => s.type === "dbSchema");
    expect(dbSection?.available).toBe(true);
    expect(dbSection?.count).toBe(2);
  });
});
