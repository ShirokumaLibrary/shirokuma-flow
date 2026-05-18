import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * details-entity-pages ジェネレーターテスト
 *
 * エンティティ詳細ページ生成（Screen, Component, Action, Table, Module）と
 * JSON データ収集（collectDetailJsonItem）をテストする。
 *
 * @testdoc エンティティ詳細ページ生成・JSON データ収集の回帰テスト
 */

import type {
  DetailsContext,
  Screen,
  Component,
  Action,
  Table,
  Module,
  CategorizedTestCase,
  TestCoverageAnalysis,
} from "../../src/commands/details-types.js";

// =============================================================================
// Mocks (ESM: unstable_mockModule + dynamic import)
// =============================================================================

const mockWriteFile = vi.fn();
const mockEnsureDir = vi.fn();

vi.mock("../../src/utils/file.js", () => ({
  writeFile: mockWriteFile,
  ensureDir: mockEnsureDir,
  readFileIfExists: vi.fn(),
}));

const mockInferAppFromPath = vi.fn().mockReturnValue("web");

vi.mock("../../src/utils/app-inference.js", () => ({
  inferAppFromPath: mockInferAppFromPath,
}));

const mockExtractModuleName = vi.fn().mockReturnValue("dashboard");
const mockReadSourceCode = vi.fn().mockReturnValue("export default function Test() {}");
const mockExtractFunctionCode = vi.fn().mockReturnValue("function Test() {}");

vi.mock("../../src/commands/details-context.js", () => ({
  extractModuleName: mockExtractModuleName,
  readSourceCode: mockReadSourceCode,
  extractFunctionCode: mockExtractFunctionCode,
}));

const mockExtractJSDoc = vi.fn().mockReturnValue("");
const mockParseJSDocForJson = vi.fn().mockReturnValue({
  description: "",
  params: [],
  returns: undefined,
  throws: [],
  examples: [],
  tags: [],
});

vi.mock("../../src/parsers/details-jsdoc.js", () => ({
  extractJSDoc: mockExtractJSDoc,
  parseJSDocForJson: mockParseJSDocForJson,
}));

const mockParseZodSchema = vi.fn().mockReturnValue(null);

vi.mock("../../src/parsers/details-zod.js", () => ({
  parseZodSchema: mockParseZodSchema,
}));

const mockFindTestCasesForElement = vi.fn().mockReturnValue([]);
const mockAnalyzeTestCoverage = vi.fn().mockReturnValue({
  totalTests: 0,
  byCategory: {
    "happy-path": [],
    "error-handling": [],
    auth: [],
    validation: [],
    "edge-case": [],
    integration: [],
    other: [],
  },
  missingPatterns: [],
  coverageScore: 0,
  recommendations: [],
});

vi.mock("../../src/analyzers/details-test-analysis.js", () => ({
  findTestCasesForElement: mockFindTestCasesForElement,
  analyzeTestCoverage: mockAnalyzeTestCoverage,
}));

const mockGenerateDetailHTML = vi.fn().mockReturnValue("<html>mock</html>");

vi.mock("../../src/generators/details-html.js", () => ({
  generateDetailHTML: mockGenerateDetailHTML,
}));

const {
  collectDetailJsonItem,
  generateScreenDetailPage,
  generateComponentDetailPage,
  generateActionDetailPage,
  generateTableDetailPage,
  generateModuleItemDetailPage,
} = await import("../../src/generators/details-entity-pages.js");

afterEach(() => {
  vi.restoreAllMocks();
  mockWriteFile.mockReset();
  mockEnsureDir.mockReset();
  mockGenerateDetailHTML.mockReset().mockReturnValue("<html>mock</html>");
  mockExtractModuleName.mockReset().mockReturnValue("dashboard");
  mockReadSourceCode.mockReset().mockReturnValue("export default function Test() {}");
  mockExtractFunctionCode.mockReset().mockReturnValue("function Test() {}");
  mockExtractJSDoc.mockReset().mockReturnValue("");
  mockParseJSDocForJson.mockReset().mockReturnValue({
    description: "",
    params: [],
    returns: undefined,
    throws: [],
    examples: [],
    tags: [],
  });
  mockFindTestCasesForElement.mockReset().mockReturnValue([]);
  mockAnalyzeTestCoverage.mockReset().mockReturnValue({
    totalTests: 0,
    byCategory: {
      "happy-path": [],
      "error-handling": [],
      auth: [],
      validation: [],
      "edge-case": [],
      integration: [],
      other: [],
    },
    missingPatterns: [],
    coverageScore: 0,
    recommendations: [],
  });
  mockParseZodSchema.mockReset().mockReturnValue(null);
  mockInferAppFromPath.mockReset().mockReturnValue("web");
});

// =============================================================================
// Helpers
// =============================================================================

function createEmptyContext(): DetailsContext {
  return {
    allTestCases: [],
    detailsJsonItems: {},
    existingElements: {
      screens: new Map(),
      components: new Map(),
      actions: new Map(),
      modules: new Map(),
      tables: new Map(),
    },
  };
}

function createEmptyAnalysis(): TestCoverageAnalysis {
  return {
    totalTests: 0,
    byCategory: {
      "happy-path": [],
      "error-handling": [],
      auth: [],
      validation: [],
      "edge-case": [],
      integration: [],
      other: [],
    },
    missingPatterns: [],
    coverageScore: 0,
    recommendations: [],
  };
}

// =============================================================================
// collectDetailJsonItem
// =============================================================================

describe("collectDetailJsonItem", () => {
  /**
   * @testdoc 新規アイテムを ctx.detailsJsonItems に追加する
   */
  it("should add new item to ctx.detailsJsonItems", () => {
    const ctx = createEmptyContext();
    collectDetailJsonItem(
      ctx, "screen", "DashboardPage", "dashboard", "ダッシュボード",
      "src/app/dashboard/page.tsx", "export default function DashboardPage() {}",
      "", [], createEmptyAnalysis(), {}
    );

    const key = "screen/dashboard/DashboardPage";
    expect(ctx.detailsJsonItems[key]).toBeDefined();
    expect(ctx.detailsJsonItems[key].name).toBe("DashboardPage");
    expect(ctx.detailsJsonItems[key].type).toBe("screen");
    expect(ctx.detailsJsonItems[key].moduleName).toBe("dashboard");
  });

  /**
   * @testdoc 同一キーのアイテムが既存の場合に related をマージする
   */
  it("should merge related items when same key exists", () => {
    const ctx = createEmptyContext();

    collectDetailJsonItem(
      ctx, "component", "Button", "ui", "ボタン",
      "src/components/Button.tsx", "function Button() {}",
      "", [], createEmptyAnalysis(),
      { usedInScreens: ["ScreenA"] }
    );

    collectDetailJsonItem(
      ctx, "component", "Button", "ui", "ボタン",
      "src/components/Button.tsx", "function Button() {}",
      "", [], createEmptyAnalysis(),
      { usedInScreens: ["ScreenB"], usedInActions: ["ActionA"] }
    );

    const key = "component/ui/Button";
    expect(ctx.detailsJsonItems[key].related.usedInScreens).toContain("ScreenA");
    expect(ctx.detailsJsonItems[key].related.usedInScreens).toContain("ScreenB");
    expect(ctx.detailsJsonItems[key].related.usedInActions).toContain("ActionA");
  });

  /**
   * @testdoc 重複する related アイテムを排除する
   */
  it("should deduplicate related items", () => {
    const ctx = createEmptyContext();

    collectDetailJsonItem(
      ctx, "component", "Card", "ui", "カード",
      "src/components/Card.tsx", "function Card() {}",
      "", [], createEmptyAnalysis(),
      { usedInScreens: ["ScreenA", "ScreenB"] }
    );

    collectDetailJsonItem(
      ctx, "component", "Card", "ui", "カード",
      "src/components/Card.tsx", "function Card() {}",
      "", [], createEmptyAnalysis(),
      { usedInScreens: ["ScreenA", "ScreenC"] }
    );

    const key = "component/ui/Card";
    const screens = ctx.detailsJsonItems[key].related.usedInScreens!;
    expect(screens).toHaveLength(3);
    expect(new Set(screens).size).toBe(3);
  });

  /**
   * @testdoc testCoverage 情報を正しく設定する
   */
  it("should set testCoverage information correctly", () => {
    const ctx = createEmptyContext();
    const analysis: TestCoverageAnalysis = {
      ...createEmptyAnalysis(),
      totalTests: 5,
      coverageScore: 80,
      recommendations: ["テスト追加"],
    };

    collectDetailJsonItem(
      ctx, "action", "createUser", "user", "ユーザー作成",
      "src/lib/actions/create-user.ts", "async function createUser() {}",
      "", [], analysis, {}
    );

    const key = "action/user/createUser";
    expect(ctx.detailsJsonItems[key].testCoverage.coverageScore).toBe(80);
    expect(ctx.detailsJsonItems[key].testCoverage.recommendations).toContain("テスト追加");
  });

  /**
   * @testdoc @errorCodes タグからエラーコードをパースする
   */
  it("should parse error codes from @errorCodes tag", () => {
    const ctx = createEmptyContext();
    mockParseJSDocForJson.mockReturnValue({
      description: "",
      params: [],
      returns: undefined,
      throws: [],
      examples: [],
      tags: [
        { name: "errorCodes", value: "- NOT_FOUND: ユーザーが見つかりません (404)\n- UNAUTHORIZED: 認証エラー (401)" },
      ],
    });

    collectDetailJsonItem(
      ctx, "action", "getUser", "user", "ユーザー取得",
      "src/lib/actions/get-user.ts", "async function getUser() {}",
      "@errorCodes ...", [], createEmptyAnalysis(), {}
    );

    const key = "action/user/getUser";
    expect(ctx.detailsJsonItems[key].errorCodes).toHaveLength(2);
    expect(ctx.detailsJsonItems[key].errorCodes![0].code).toBe("NOT_FOUND");
    expect(ctx.detailsJsonItems[key].errorCodes![0].status).toBe(404);
    expect(ctx.detailsJsonItems[key].errorCodes![1].code).toBe("UNAUTHORIZED");
  });

  /**
   * @testdoc @authLevel タグから認証レベルを設定する
   */
  it("should set authLevel from @authLevel tag", () => {
    const ctx = createEmptyContext();
    mockParseJSDocForJson.mockReturnValue({
      description: "",
      params: [],
      returns: undefined,
      throws: [],
      examples: [],
      tags: [{ name: "authLevel", value: "admin" }],
    });

    collectDetailJsonItem(
      ctx, "action", "deleteUser", "user", "ユーザー削除",
      "src/lib/actions/delete-user.ts", "async function deleteUser() {}",
      "@authLevel admin", [], createEmptyAnalysis(), {}
    );

    const key = "action/user/deleteUser";
    expect(ctx.detailsJsonItems[key].authLevel).toBe("admin");
  });

  /**
   * @testdoc @csrfProtection タグから CSRF 保護設定を読み取る
   */
  it("should parse csrfProtection from tag", () => {
    const ctx = createEmptyContext();
    mockParseJSDocForJson.mockReturnValue({
      description: "",
      params: [],
      returns: undefined,
      throws: [],
      examples: [],
      tags: [{ name: "csrfProtection", value: "true" }],
    });

    collectDetailJsonItem(
      ctx, "action", "update", "user", "更新",
      "src/lib/actions/update.ts", "async function update() {}",
      "@csrfProtection true", [], createEmptyAnalysis(), {}
    );

    const key = "action/user/update";
    expect(ctx.detailsJsonItems[key].csrfProtection).toBe(true);
  });

  /**
   * @testdoc app フィールドに inferAppFromPath の結果を設定する
   */
  it("should set app field from inferAppFromPath", () => {
    const ctx = createEmptyContext();
    mockInferAppFromPath.mockReturnValue("admin");

    collectDetailJsonItem(
      ctx, "screen", "AdminPage", "admin", "管理画面",
      "apps/admin/app/page.tsx", "export default function AdminPage() {}",
      "", [], createEmptyAnalysis(), {}
    );

    const key = "screen/admin/AdminPage";
    expect(ctx.detailsJsonItems[key].app).toBe("admin");
  });
});

// =============================================================================
// generateScreenDetailPage
// =============================================================================

describe("generateScreenDetailPage", () => {
  /**
   * @testdoc Screen 詳細ページの HTML を生成して writeFile で書き込む
   */
  it("should generate and write screen detail page", () => {
    const screen: Screen = {
      name: "DashboardPage",
      path: "src/app/dashboard/page.tsx",
      route: "/dashboard",
      description: "ダッシュボード画面",
    };
    const ctx = createEmptyContext();

    generateScreenDetailPage(screen, "/output/details", "/project", "TestProject", ctx);

    expect(mockEnsureDir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockGenerateDetailHTML).toHaveBeenCalledTimes(1);

    const htmlDataArg = mockGenerateDetailHTML.mock.calls[0][0];
    expect(htmlDataArg.type).toBe("screen");
    expect(htmlDataArg.name).toBe("DashboardPage");
    expect(htmlDataArg.route).toBe("/dashboard");
  });

  /**
   * @testdoc ctx に JSON データを収集する
   */
  it("should collect JSON data in ctx", () => {
    const screen: Screen = {
      name: "ProfilePage",
      path: "src/app/profile/page.tsx",
      route: "/profile",
      description: "プロフィール画面",
    };
    const ctx = createEmptyContext();

    generateScreenDetailPage(screen, "/output/details", "/project", "TestProject", ctx);

    const key = "screen/dashboard/ProfilePage";
    expect(ctx.detailsJsonItems[key]).toBeDefined();
  });
});

// =============================================================================
// generateComponentDetailPage
// =============================================================================

describe("generateComponentDetailPage", () => {
  /**
   * @testdoc Component 詳細ページの HTML を生成して writeFile で書き込む
   */
  it("should generate and write component detail page", () => {
    const component: Component = {
      name: "StatsCard",
      path: "src/components/StatsCard.tsx",
      description: "統計カード",
      usedInScreens: ["DashboardPage"],
    };
    const ctx = createEmptyContext();

    generateComponentDetailPage(component, "/output/details", "/project", "TestProject", ctx);

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockGenerateDetailHTML).toHaveBeenCalledTimes(1);

    const htmlDataArg = mockGenerateDetailHTML.mock.calls[0][0];
    expect(htmlDataArg.type).toBe("component");
    expect(htmlDataArg.name).toBe("StatsCard");
  });
});

// =============================================================================
// generateActionDetailPage
// =============================================================================

describe("generateActionDetailPage", () => {
  /**
   * @testdoc Action 詳細ページの HTML を生成して writeFile で書き込む
   */
  it("should generate and write action detail page", () => {
    const action: Action = {
      name: "createUser",
      path: "src/lib/actions/create-user.ts",
      description: "ユーザー作成アクション",
      actionType: "CRUD",
    };
    const ctx = createEmptyContext();

    generateActionDetailPage(action, "/output/details", "/project", "TestProject", ctx);

    expect(mockWriteFile).toHaveBeenCalledTimes(1);

    const htmlDataArg = mockGenerateDetailHTML.mock.calls[0][0];
    expect(htmlDataArg.type).toBe("action");
    expect(htmlDataArg.name).toBe("createUser");
    expect(htmlDataArg.actionType).toBe("CRUD");
  });

  /**
   * @testdoc ソースコードに認証パターンが含まれる場合に hasAuth=true で分析する
   */
  it("should detect auth patterns in source code", () => {
    mockReadSourceCode.mockReturnValue("async function createUser() { const session = await getSession(); }");
    const action: Action = {
      name: "createUser",
      path: "src/lib/actions/create-user.ts",
      description: "ユーザー作成",
    };
    const ctx = createEmptyContext();

    generateActionDetailPage(action, "/output/details", "/project", "TestProject", ctx);

    // analyzeTestCoverage が hasAuth=true で呼ばれることを確認
    expect(mockAnalyzeTestCoverage).toHaveBeenCalledWith(
      expect.anything(),
      true,
      false
    );
  });

  /**
   * @testdoc dbTables がある場合に hasDb=true で分析する
   */
  it("should detect DB usage from dbTables", () => {
    const action: Action = {
      name: "createUser",
      path: "src/lib/actions/create-user.ts",
      description: "ユーザー作成",
      dbTables: ["users"],
    };
    const ctx = createEmptyContext();

    generateActionDetailPage(action, "/output/details", "/project", "TestProject", ctx);

    expect(mockAnalyzeTestCoverage).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      true
    );
  });
});

// =============================================================================
// generateTableDetailPage
// =============================================================================

describe("generateTableDetailPage", () => {
  /**
   * @testdoc Table 詳細ページの HTML を生成して writeFile で書き込む
   */
  it("should generate and write table detail page", () => {
    const table: Table = {
      name: "users",
      path: "packages/db/src/schema/users.ts",
      description: "ユーザーテーブル",
      usedInActions: ["createUser"],
    };
    const ctx = createEmptyContext();

    generateTableDetailPage(table, "/output/details", "/project", "TestProject", ctx);

    expect(mockWriteFile).toHaveBeenCalledTimes(1);

    const htmlDataArg = mockGenerateDetailHTML.mock.calls[0][0];
    expect(htmlDataArg.type).toBe("table");
    expect(htmlDataArg.name).toBe("users");
  });

  /**
   * @testdoc analyzeTestCoverage を hasDb=true で呼び出す
   */
  it("should call analyzeTestCoverage with hasDb=true", () => {
    const table: Table = {
      name: "users",
      path: "packages/db/src/schema/users.ts",
      description: "ユーザーテーブル",
    };
    const ctx = createEmptyContext();

    generateTableDetailPage(table, "/output/details", "/project", "TestProject", ctx);

    expect(mockAnalyzeTestCoverage).toHaveBeenCalledWith(
      expect.anything(),
      false,
      true
    );
  });
});

// =============================================================================
// generateModuleItemDetailPage
// =============================================================================

describe("generateModuleItemDetailPage", () => {
  /**
   * @testdoc Module 詳細ページの HTML を生成して writeFile で書き込む
   */
  it("should generate and write module item detail page", () => {
    const mod: Module = {
      name: "authUtils",
      path: "src/lib/auth/utils.ts",
      description: "認証ユーティリティ",
      usedInScreens: ["LoginPage"],
      usedInActions: ["loginAction"],
    };
    const ctx = createEmptyContext();

    generateModuleItemDetailPage(mod, "auth", "/output/details", "/project", "TestProject", ctx);

    expect(mockWriteFile).toHaveBeenCalledTimes(1);

    const htmlDataArg = mockGenerateDetailHTML.mock.calls[0][0];
    expect(htmlDataArg.type).toBe("module");
    expect(htmlDataArg.name).toBe("authUtils");
    expect(htmlDataArg.moduleName).toBe("auth");
  });

  /**
   * @testdoc featureName を moduleName として使用する
   */
  it("should use featureName as moduleName", () => {
    const mod: Module = {
      name: "utils",
      path: "src/lib/security/utils.ts",
    };
    const ctx = createEmptyContext();

    generateModuleItemDetailPage(mod, "security", "/output/details", "/project", "TestProject", ctx);

    const key = "module/security/utils";
    expect(ctx.detailsJsonItems[key]).toBeDefined();
    expect(ctx.detailsJsonItems[key].moduleName).toBe("security");
  });

  /**
   * @testdoc 7 種類の related タイプ全てを HTML データに含む
   */
  it("should include all 7 related types in HTML data", () => {
    const mod: Module = {
      name: "middleware",
      path: "src/lib/auth/middleware.ts",
      usedInScreens: ["A"],
      usedInComponents: ["B"],
      usedInActions: ["C"],
      usedInMiddleware: ["D"],
      usedInLayouts: ["E"],
      usedModules: ["F"],
      usedInModules: ["G"],
    };
    const ctx = createEmptyContext();

    generateModuleItemDetailPage(mod, "auth", "/output/details", "/project", "TestProject", ctx);

    const htmlDataArg = mockGenerateDetailHTML.mock.calls[0][0];
    expect(htmlDataArg.related).toHaveLength(7);
  });
});
