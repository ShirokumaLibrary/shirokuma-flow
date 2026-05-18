import { describe, it, expect, vi, beforeEach } from 'vitest';
/**
 * PortalGenerator テスト
 *
 * @testdoc src/generators/portal/index.ts のテスト
 */

// =============================================================================
// Mocks（vi.hoisted で hoisting 対応）
// =============================================================================

const mocks = vi.hoisted(() => ({
  registerHelpers: vi.fn(),
  registerPartials: vi.fn(),
  templatesExist: vi.fn(),
  getTemplatesDirPath: vi.fn().mockReturnValue("/templates/portal"),
  loadPortalData: vi.fn(),
  generateSearchIndex: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(),
  copyFileSync: vi.fn(),
  readFileSync: vi.fn(),
  generateHomePage: vi.fn(() => "<div>home</div>"),
  generateOverviewPage: vi.fn(() => "<div>overview</div>"),
  generateFeatureMapPage: vi.fn(() => "<div>feature-map</div>"),
  generateFeatureMapAppPage: vi.fn(() => "<div>feature-map-app</div>"),
  generateTestCasesPage: vi.fn(() => "<div>test-cases</div>"),
  generateTestCasesFilePage: vi.fn(() => "<div>test-cases-file</div>"),
  generateTestCaseDetailPage: vi.fn(() => "<div>test-cases-detail</div>"),
  generateDbSchemaPage: vi.fn(() => "<div>db-schema</div>"),
  generateDbSchemaDbPage: vi.fn(() => "<div>db-schema-db</div>"),
  generateDbSchemaTablePage: vi.fn(() => "<div>db-schema-table</div>"),
  generateDbDiagramPage: vi.fn(() => "<div>db-diagram</div>"),
  generateI18nPage: vi.fn(() => "<div>i18n</div>"),
  generateI18nNamespacePage: vi.fn(() => "<div>i18n-ns</div>"),
  generatePackagesPage: vi.fn(() => "<div>packages</div>"),
  generatePackageDetailPage: vi.fn(() => "<div>packages-detail</div>"),
  generateApiToolsPage: vi.fn(() => "<div>api-tools</div>"),
  generateDetailsModulePage: vi.fn(() => "<div>details-module</div>"),
  generateDetailsItemPage: vi.fn(() => "<div>details-item</div>"),
  generateAppsHomePage: vi.fn(() => "<div>apps-home</div>"),
}));

vi.mock("../../src/generators/portal/helpers.js", () => ({
  registerHelpers: mocks.registerHelpers,
}));

vi.mock("../../src/generators/portal/renderer.js", () => ({
  registerPartials: mocks.registerPartials,
  templatesExist: mocks.templatesExist,
  getTemplatesDirPath: mocks.getTemplatesDirPath,
  renderTemplate: vi.fn(() => "<div>content</div>"),
}));

vi.mock("../../src/generators/portal/data-processor.js", () => ({
  loadPortalData: mocks.loadPortalData,
}));

vi.mock("../../src/generators/portal/search-index-generator.js", () => ({
  generateSearchIndex: mocks.generateSearchIndex,
}));

vi.mock("../../src/generators/portal/sidebar-builder.js", () => ({
  buildSidebarData: vi.fn(() => []),
}));

vi.mock("../../src/generators/portal/layout-builder.js", () => ({
  wrapWithLayout: vi.fn(() => "<html>page</html>"),
}));

vi.mock("../../src/generators/portal/pages/home.js", () => ({
  generateHomePage: mocks.generateHomePage,
}));
vi.mock("../../src/generators/portal/pages/overview.js", () => ({
  generateOverviewPage: mocks.generateOverviewPage,
}));
vi.mock("../../src/generators/portal/pages/feature-map.js", () => ({
  generateFeatureMapPage: mocks.generateFeatureMapPage,
  generateFeatureMapAppPage: mocks.generateFeatureMapAppPage,
}));
vi.mock("../../src/generators/portal/pages/test-cases.js", () => ({
  generateTestCasesPage: mocks.generateTestCasesPage,
  generateTestCasesFilePage: mocks.generateTestCasesFilePage,
  generateTestCaseDetailPage: mocks.generateTestCaseDetailPage,
}));
vi.mock("../../src/generators/portal/pages/db-schema.js", () => ({
  generateDbSchemaPage: mocks.generateDbSchemaPage,
  generateDbSchemaDbPage: mocks.generateDbSchemaDbPage,
  generateDbSchemaTablePage: mocks.generateDbSchemaTablePage,
  generateDbDiagramPage: mocks.generateDbDiagramPage,
}));
vi.mock("../../src/generators/portal/pages/i18n.js", () => ({
  generateI18nPage: mocks.generateI18nPage,
  generateI18nNamespacePage: mocks.generateI18nNamespacePage,
}));
vi.mock("../../src/generators/portal/pages/packages.js", () => ({
  generatePackagesPage: mocks.generatePackagesPage,
  generatePackageDetailPage: mocks.generatePackageDetailPage,
}));
vi.mock("../../src/generators/portal/pages/api-tools.js", () => ({
  generateApiToolsPage: mocks.generateApiToolsPage,
}));
vi.mock("../../src/generators/portal/pages/details.js", () => ({
  generateDetailsModulePage: mocks.generateDetailsModulePage,
  generateDetailsItemPage: mocks.generateDetailsItemPage,
  getItemsByType: (group: Record<string, unknown[]>, type: string) => {
    const map: Record<string, string> = { screen: "screens", component: "components", action: "actions", module: "modules", table: "tables" };
    return (group as Record<string, unknown[]>)[map[type] || type] || [];
  },
}));
vi.mock("../../src/generators/portal/pages/apps.js", () => ({
  generateAppsHomePage: mocks.generateAppsHomePage,
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
  mkdirSync: mocks.mkdirSync,
  writeFileSync: mocks.writeFileSync,
  readFileSync: mocks.readFileSync,
  readdirSync: mocks.readdirSync,
  copyFileSync: mocks.copyFileSync,
}));

const { PortalGenerator } = await import(
  "../../src/generators/portal/index.js"
);

// =============================================================================
// テストデータ
// =============================================================================

const minimalPortalData = {
  projectName: "TestProject",
  featureMap: null,
  testCases: null,
  dbSchema: null,
  details: null,
  applications: {
    shared: { sections: [] },
    apps: [],
  },
  i18n: null,
  packages: null,
  apiTools: null,
  coverage: null,
  overview: null,
  githubData: null,
  available: {
    hasFeatureMap: false,
    hasTestCases: false,
    hasDbSchema: false,
    hasDetails: false,
    hasApplications: true,
    hasI18n: false,
    hasPackages: false,
    hasApiTools: false,
    hasOverview: false,
    hasGithubData: false,
  },
};

// =============================================================================
// ヘルパー
// =============================================================================

function createGenerator() {
  return new PortalGenerator({
    projectPath: "/project",
    projectName: "Test",
    outputDir: "/output",
  });
}

function writtenPaths(): string[] {
  return (mocks.writeFileSync as ReturnType<typeof vi.fn>).mock.calls.map(
    (call: unknown[]) => call[0] as string
  );
}

// =============================================================================
// Tests
// =============================================================================

describe("PortalGenerator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.templatesExist.mockReturnValue(true);
    mocks.loadPortalData.mockReturnValue(minimalPortalData);
    mocks.generateSearchIndex.mockReturnValue({ items: [], generatedAt: "2026-01-01" });
    mocks.existsSync.mockReturnValue(true);
    mocks.readdirSync.mockReturnValue(["portal.css", "portal.js"]);
  });

  /**
   * @testdoc テンプレートが存在しない場合にエラーをスローする
   */
  it("should throw when templates directory does not exist", async () => {
    mocks.templatesExist.mockReturnValue(false);

    await expect(createGenerator().generate()).rejects.toThrow(
      "ポータルテンプレートが見つかりません"
    );
  });

  /**
   * @testdoc 最小データ（全データ null）でホームページのみ生成する
   */
  it("should generate only home page with minimal data", async () => {
    await createGenerator().generate();

    expect(mocks.registerHelpers).toHaveBeenCalledTimes(1);
    expect(mocks.registerPartials).toHaveBeenCalledTimes(1);
    expect(mocks.loadPortalData).toHaveBeenCalledTimes(1);
    expect(writtenPaths().some((p) => p.endsWith("index.html"))).toBe(true);
  });

  /**
   * @testdoc search-index.json が既に存在する場合は再生成しない
   */
  it("should not regenerate search index if it already exists", async () => {
    mocks.existsSync.mockImplementation((p: unknown) => {
      return typeof p === "string" && (p as string).includes("search-index.json");
    });

    await createGenerator().generate();

    expect(mocks.generateSearchIndex).not.toHaveBeenCalled();
  });

  /**
   * @testdoc search-index.json が存在しない場合は生成する
   */
  it("should generate search index when it does not exist", async () => {
    mocks.existsSync.mockImplementation((p: unknown) => {
      if (typeof p === "string" && (p as string).includes("search-index.json")) return false;
      return true;
    });

    await createGenerator().generate();

    expect(mocks.generateSearchIndex).toHaveBeenCalledTimes(1);
    expect(writtenPaths().some((p) => p.includes("search-index.json"))).toBe(true);
  });

  /**
   * @testdoc assets ディレクトリのファイルをコピーする
   */
  it("should copy assets files to output", async () => {
    await createGenerator().generate();

    expect(mocks.copyFileSync).toHaveBeenCalledTimes(2);
  });

  /**
   * @testdoc verbose オプションでログが出力される
   */
  it("should log when verbose is enabled", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const generator = new PortalGenerator({
      projectPath: "/project",
      projectName: "Test",
      outputDir: "/output",
      verbose: true,
    });

    await generator.generate();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  /**
   * @testdoc overview データがある場合は概要ページを生成する
   */
  it("should generate overview page when overview is available", async () => {
    mocks.loadPortalData.mockReturnValue({
      ...minimalPortalData,
      overview: { content: "# Overview" },
      available: { ...minimalPortalData.available, hasOverview: true },
    });

    await createGenerator().generate();

    expect(mocks.generateOverviewPage).toHaveBeenCalled();
    expect(writtenPaths().some((p) => p.includes("overview"))).toBe(true);
  });

  /**
   * @testdoc feature-map がある場合は機能マップページを生成する
   */
  it("should generate feature-map page when featureMap is available", async () => {
    mocks.loadPortalData.mockReturnValue({
      ...minimalPortalData,
      featureMap: {
        features: {
          Auth: { screens: [], components: [], actions: [], tables: [], modules: [] },
        },
        uncategorized: { screens: [], components: [], actions: [], tables: [], modules: [] },
        moduleDescriptions: {},
        moduleTypes: {},
        moduleUtilities: {},
        generatedAt: "2026-01-01",
      },
      available: { ...minimalPortalData.available, hasFeatureMap: true },
    });

    await createGenerator().generate();

    expect(mocks.generateFeatureMapPage).toHaveBeenCalled();
    expect(writtenPaths().some((p) => p.includes("feature-map"))).toBe(true);
  });

  /**
   * @testdoc DB スキーマデータがある場合は一覧/ER図/テーブル詳細ページを生成する
   */
  it("should generate db-schema pages with diagram and table detail", async () => {
    mocks.loadPortalData.mockReturnValue({
      ...minimalPortalData,
      dbSchema: {
        tables: [
          { name: "users", columns: [{ name: "id", type: "int" }], foreignKeys: [] },
          { name: "posts", columns: [{ name: "id", type: "int" }], foreignKeys: [] },
        ],
        databases: [],
      },
      available: { ...minimalPortalData.available, hasDbSchema: true },
    });

    await createGenerator().generate();

    expect(mocks.generateDbSchemaPage).toHaveBeenCalled();
    expect(mocks.generateDbDiagramPage).toHaveBeenCalled();
    expect(mocks.generateDbSchemaTablePage).toHaveBeenCalledTimes(2);
  });

  /**
   * @testdoc 複数 DB がある場合は DB 別ページも生成する
   */
  it("should generate per-database pages when multiple databases exist", async () => {
    mocks.loadPortalData.mockReturnValue({
      ...minimalPortalData,
      dbSchema: {
        tables: [{ name: "users", columns: [], foreignKeys: [] }],
        databases: [{ name: "primary" }, { name: "analytics" }],
      },
      available: { ...minimalPortalData.available, hasDbSchema: true },
    });

    await createGenerator().generate();

    expect(mocks.generateDbSchemaDbPage).toHaveBeenCalledTimes(2);
  });

  /**
   * @testdoc テストケースデータがある場合はファイル別・詳細ページを生成する
   */
  it("should generate test-cases pages with file and detail pages", async () => {
    mocks.loadPortalData.mockReturnValue({
      ...minimalPortalData,
      testCases: {
        testCases: [
          { file: "src/auth.test.ts", line: 10, describe: "Auth", it: "login" },
          { file: "src/auth.test.ts", line: 20, describe: "Auth", it: "logout" },
          { file: "src/user.test.ts", line: 5, describe: "User", it: "create" },
        ],
        summary: { totalTests: 3, totalFiles: 2 },
      },
      available: { ...minimalPortalData.available, hasTestCases: true },
    });

    await createGenerator().generate();

    expect(mocks.generateTestCasesPage).toHaveBeenCalledTimes(1);
    expect(mocks.generateTestCasesFilePage).toHaveBeenCalledTimes(2);
    expect(mocks.generateTestCaseDetailPage).toHaveBeenCalledTimes(3);
  });

  /**
   * @testdoc i18n データがある場合は一覧/名前空間別ページを生成する
   */
  it("should generate i18n pages with namespace pages", async () => {
    mocks.loadPortalData.mockReturnValue({
      ...minimalPortalData,
      i18n: {
        namespaces: [{ name: "common" }, { name: "auth" }],
        summary: { totalKeys: 10, totalNamespaces: 2 },
      },
      available: { ...minimalPortalData.available, hasI18n: true },
    });

    await createGenerator().generate();

    expect(mocks.generateI18nPage).toHaveBeenCalledTimes(1);
    expect(mocks.generateI18nNamespacePage).toHaveBeenCalledTimes(2);
  });

  /**
   * @testdoc パッケージデータがある場合は一覧/詳細ページを生成する
   */
  it("should generate packages pages with detail pages", async () => {
    mocks.loadPortalData.mockReturnValue({
      ...minimalPortalData,
      packages: {
        packages: [
          { name: "core", version: "1.0.0" },
          { name: "utils", version: "2.0.0" },
        ],
      },
      available: { ...minimalPortalData.available, hasPackages: true },
    });

    await createGenerator().generate();

    expect(mocks.generatePackagesPage).toHaveBeenCalledTimes(1);
    expect(mocks.generatePackageDetailPage).toHaveBeenCalledTimes(2);
  });

  /**
   * @testdoc API ツールデータがある場合は API ツールページを生成する
   */
  it("should generate api-tools page when apiTools is available", async () => {
    mocks.loadPortalData.mockReturnValue({
      ...minimalPortalData,
      available: { ...minimalPortalData.available, hasApiTools: true },
    });

    await createGenerator().generate();

    expect(mocks.generateApiToolsPage).toHaveBeenCalledTimes(1);
  });

  /**
   * @testdoc アプリケーションがある場合はアプリ別ホームページを生成する
   */
  it("should generate application home pages", async () => {
    mocks.loadPortalData.mockReturnValue({
      ...minimalPortalData,
      applications: {
        shared: { sections: [] },
        apps: [
          { id: "web", name: "Web App" },
          { id: "mcp", name: "MCP Server" },
        ],
      },
      available: { ...minimalPortalData.available, hasApplications: true },
    });

    await createGenerator().generate();

    expect(mocks.generateAppsHomePage).toHaveBeenCalledTimes(2);
  });

  /**
   * @testdoc 出力先ディレクトリが存在しない場合は作成する
   */
  it("should create output directories when they do not exist", async () => {
    mocks.existsSync.mockReturnValue(false);

    await createGenerator().generate();

    expect(mocks.mkdirSync).toHaveBeenCalledWith(
      expect.any(String),
      { recursive: true }
    );
  });
});
