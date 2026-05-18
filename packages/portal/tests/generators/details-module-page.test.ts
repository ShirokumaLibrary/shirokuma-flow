import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * details-module-page ジェネレーターテスト
 *
 * モジュール詳細ページの HTML 生成関数（buildModuleTestsList, getItemMeta,
 * getModuleStats, buildTypeItem, buildUtilityItem, generateModuleDetailPage）をテストする。
 *
 * @testdoc モジュール詳細ページ HTML 生成の回帰テスト
 */

import type {
  ModulePageData,
  Screen,
  Component,
  Action,
  Table,
  TypeItem,
  UtilityItem,
  CategorizedTestCase,
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

// Dynamic import after mocks
const {
  buildModuleTestsList,
  generateModuleDetailPage,
  getItemMeta,
  getModuleStats,
  buildTypeItem,
  buildUtilityItem,
} = await import("../../src/generators/details-module-page.js");

// =============================================================================
// Helpers
// =============================================================================

function createTestCase(overrides: Partial<CategorizedTestCase> = {}): CategorizedTestCase {
  return {
    file: "__tests__/dashboard.test.ts",
    describe: "Dashboard",
    it: "should render",
    line: 10,
    framework: "jest",
    category: "happy-path",
    summary: "ダッシュボード描画テスト",
    ...overrides,
  };
}

function createScreen(overrides: Partial<Screen> = {}): Screen {
  return {
    name: "DashboardPage",
    path: "src/app/dashboard/page.tsx",
    route: "/dashboard",
    description: "ダッシュボード画面",
    ...overrides,
  };
}

function createComponent(overrides: Partial<Component> = {}): Component {
  return {
    name: "StatsCard",
    path: "src/components/StatsCard.tsx",
    description: "統計カード",
    ...overrides,
  };
}

function createAction(overrides: Partial<Action> = {}): Action {
  return {
    name: "createUser",
    path: "src/actions/createUser.ts",
    description: "ユーザー作成",
    ...overrides,
  };
}

function createTable(overrides: Partial<Table> = {}): Table {
  return {
    name: "users",
    path: "src/db/schema/users.ts",
    description: "ユーザーテーブル",
    ...overrides,
  };
}

// =============================================================================
// buildModuleTestsList
// =============================================================================

describe("buildModuleTestsList", () => {
  /**
   * @testdoc テストケースが空の場合「関連するテストが見つかりませんでした」を返す
   */
  it("should return empty message when testCases is empty", () => {
    const result = buildModuleTestsList([], "dashboard");
    expect(result).toContain("関連するテストが見つかりませんでした");
  });

  /**
   * @testdoc テストケースをファイル別にグループ化して表示する
   */
  it("should group test cases by file", () => {
    const cases = [
      createTestCase({ file: "__tests__/a.test.ts", summary: "テストA" }),
      createTestCase({ file: "__tests__/b.test.ts", summary: "テストB" }),
      createTestCase({ file: "__tests__/a.test.ts", summary: "テストA2" }),
    ];
    const result = buildModuleTestsList(cases, "dashboard");
    expect(result).toContain("a.test.ts");
    expect(result).toContain("b.test.ts");
    expect(result).toContain("module-test-file-section");
  });

  /**
   * @testdoc 5件以上のテストケースがある場合に「+N more tests」リンクを表示する
   */
  it("should show more link when file has more than 5 test cases", () => {
    const cases = Array.from({ length: 7 }, (_, i) =>
      createTestCase({ summary: `テスト${i}` })
    );
    const result = buildModuleTestsList(cases, "dashboard");
    expect(result).toContain("+2 more tests");
  });

  /**
   * @testdoc テストケースの件数を表示する
   */
  it("should show test count per file", () => {
    const cases = [
      createTestCase(),
      createTestCase(),
      createTestCase(),
    ];
    const result = buildModuleTestsList(cases, "dashboard");
    expect(result).toContain("3 tests");
  });
});

// =============================================================================
// getItemMeta
// =============================================================================

describe("getItemMeta", () => {
  /**
   * @testdoc screen タイプでルート情報がある場合にルートスパンを返す
   */
  it("should return route span for screen with route", () => {
    const screen = createScreen({ route: "/dashboard" });
    const result = getItemMeta("screen", screen);
    expect(result).toContain("item-route");
    expect(result).toContain("/dashboard");
  });

  /**
   * @testdoc screen タイプでルートがない場合に空文字を返す
   */
  it("should return empty string for screen without route", () => {
    const screen = createScreen({ route: "" });
    const result = getItemMeta("screen", screen);
    expect(result).toBe("");
  });

  /**
   * @testdoc component タイプで使用画面がある場合に画面数を返す
   */
  it("should return screens count for component with usedInScreens", () => {
    const comp = createComponent({ usedInScreens: ["Dashboard", "Settings"] });
    const result = getItemMeta("component", comp);
    expect(result).toContain("2 screens");
  });

  /**
   * @testdoc action タイプで DB テーブルがある場合にテーブル数を返す
   */
  it("should return tables count for action with dbTables", () => {
    const action = createAction({ dbTables: ["users", "sessions"] });
    const result = getItemMeta("action", action);
    expect(result).toContain("2 tables");
  });

  /**
   * @testdoc table タイプで使用アクションがある場合にアクション数を返す
   */
  it("should return actions count for table with usedInActions", () => {
    const table = createTable({ usedInActions: ["createUser", "deleteUser", "updateUser"] });
    const result = getItemMeta("table", table);
    expect(result).toContain("3 actions");
  });

  /**
   * @testdoc 未知のタイプは空文字を返す
   */
  it("should return empty string for unknown type", () => {
    const result = getItemMeta("unknown", createScreen());
    expect(result).toBe("");
  });
});

// =============================================================================
// getModuleStats
// =============================================================================

describe("getModuleStats", () => {
  /**
   * @testdoc action タイプで DB テーブルの統計を返す
   */
  it("should return DB Tables stat for action type", () => {
    const items = [
      createAction({ dbTables: ["users", "sessions"] }),
      createAction({ dbTables: ["users", "projects"] }),
    ];
    const result = getModuleStats("action", items);
    expect(result).toContain("DB Tables");
    // users は重複除去されて 3 テーブル
    expect(result).toContain("3");
  });

  /**
   * @testdoc component タイプで使用画面の統計を返す
   */
  it("should return Used in Screens stat for component type", () => {
    const items = [
      createComponent({ usedInScreens: ["Dashboard"] }),
      createComponent({ usedInScreens: ["Dashboard", "Settings"] }),
    ];
    const result = getModuleStats("component", items);
    expect(result).toContain("Used in Screens");
    expect(result).toContain("2");
  });

  /**
   * @testdoc screen タイプでは空文字を返す
   */
  it("should return empty string for screen type", () => {
    const items = [createScreen()];
    const result = getModuleStats("screen", items);
    expect(result).toBe("");
  });

  /**
   * @testdoc action タイプで DB テーブルがない場合は空文字を返す
   */
  it("should return empty string for action type with no dbTables", () => {
    const items = [createAction({ dbTables: [] })];
    const result = getModuleStats("action", items);
    expect(result).toBe("");
  });
});

// =============================================================================
// buildTypeItem
// =============================================================================

describe("buildTypeItem", () => {
  /**
   * @testdoc interface タイプに青色バッジを付与する
   */
  it("should render interface with blue badge", () => {
    const type: TypeItem = {
      name: "UserProfile",
      kind: "interface",
      fields: [{ name: "id", type: "string" }],
    };
    const result = buildTypeItem(type);
    expect(result).toContain("UserProfile");
    expect(result).toContain("badge-blue");
    expect(result).toContain("interface");
  });

  /**
   * @testdoc enum タイプに値リストを表示する
   */
  it("should render enum with values list", () => {
    const type: TypeItem = {
      name: "Status",
      kind: "enum",
      values: ["active", "inactive", "pending"],
    };
    const result = buildTypeItem(type);
    expect(result).toContain("Status");
    expect(result).toContain("badge-purple");
    expect(result).toContain("active");
    expect(result).toContain("inactive");
    expect(result).toContain("pending");
  });

  /**
   * @testdoc ソースコードがある場合にコードブロックを表示する
   */
  it("should render code block when sourceCode is present", () => {
    const type: TypeItem = {
      name: "Config",
      kind: "interface",
      sourceCode: `/** 設定 */\ninterface Config {\n  name: string;\n}`,
    };
    const result = buildTypeItem(type);
    expect(result).toContain("code-block");
    expect(result).toContain("interface Config");
  });

  /**
   * @testdoc フィールドが8件を超える場合に「+N more fields」を表示する
   */
  it("should show more fields indicator when fields exceed 8", () => {
    const fields = Array.from({ length: 10 }, (_, i) => ({
      name: `field${i}`,
      type: "string",
    }));
    const type: TypeItem = {
      name: "BigType",
      kind: "interface",
      fields,
    };
    const result = buildTypeItem(type);
    expect(result).toContain("+2 more fields");
  });
});

// =============================================================================
// buildUtilityItem
// =============================================================================

describe("buildUtilityItem", () => {
  /**
   * @testdoc constant に黄色バッジと値を表示する
   */
  it("should render constant with yellow badge and value", () => {
    const util: UtilityItem = {
      name: "MAX_RETRIES",
      kind: "constant",
      value: "3",
      type: "number",
    };
    const result = buildUtilityItem(util);
    expect(result).toContain("MAX_RETRIES");
    expect(result).toContain("badge-yellow");
    expect(result).toContain("3");
  });

  /**
   * @testdoc function にシアンバッジとパラメータを表示する
   */
  it("should render function with cyan badge and params", () => {
    const util: UtilityItem = {
      name: "formatDate",
      kind: "function",
      params: [
        { name: "date", type: "Date" },
        { name: "format", type: "string" },
      ],
      type: "string",
    };
    const result = buildUtilityItem(util);
    expect(result).toContain("formatDate");
    expect(result).toContain("badge-cyan");
    expect(result).toContain("date");
    expect(result).toContain("Date");
    expect(result).toContain("format");
  });

  /**
   * @testdoc 戻り値の型情報を表示する
   */
  it("should render return type when present", () => {
    const util: UtilityItem = {
      name: "getConfig",
      kind: "function",
      type: "Config",
    };
    const result = buildUtilityItem(util);
    expect(result).toContain(": Config");
  });

  /**
   * @testdoc 説明文がある場合に表示する
   */
  it("should render description when present", () => {
    const util: UtilityItem = {
      name: "helper",
      kind: "function",
      description: "ヘルパー関数",
    };
    const result = buildUtilityItem(util);
    expect(result).toContain("ヘルパー関数");
  });
});

// =============================================================================
// generateModuleDetailPage
// =============================================================================

describe("generateModuleDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * @testdoc 正しいパスに writeFile を呼び出す
   */
  it("should call writeFile with correct output path", () => {
    const data: ModulePageData = {
      type: "screen",
      moduleName: "dashboard",
      items: [createScreen()],
      projectName: "TestProject",
    };
    generateModuleDetailPage(data, "/output/details");
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [path] = mockWriteFile.mock.calls[0];
    expect(path).toContain("/output/details/screen/dashboard.html");
  });

  /**
   * @testdoc 生成された HTML にモジュール名とタイプバッジを含む
   */
  it("should generate HTML with module name and type badge", () => {
    const data: ModulePageData = {
      type: "action",
      moduleName: "auth",
      items: [createAction()],
      projectName: "TestProject",
    };
    generateModuleDetailPage(data, "/output/details");
    const [, html] = mockWriteFile.mock.calls[0];
    expect(html).toContain("auth");
    expect(html).toContain("Server Action Module");
  });

  /**
   * @testdoc Types タブがある場合にタブとコンテンツを含む
   */
  it("should include Types tab when types are provided", () => {
    const data: ModulePageData = {
      type: "screen",
      moduleName: "dashboard",
      items: [],
      types: [{ name: "DashboardProps", kind: "interface" }],
      projectName: "TestProject",
    };
    generateModuleDetailPage(data, "/output/details");
    const [, html] = mockWriteFile.mock.calls[0];
    expect(html).toContain("Types (1)");
    expect(html).toContain("DashboardProps");
  });

  /**
   * @testdoc Utilities タブがある場合にタブとコンテンツを含む
   */
  it("should include Utilities tab when utilities are provided", () => {
    const data: ModulePageData = {
      type: "screen",
      moduleName: "dashboard",
      items: [],
      utilities: [{ name: "formatDate", kind: "function" }],
      projectName: "TestProject",
    };
    generateModuleDetailPage(data, "/output/details");
    const [, html] = mockWriteFile.mock.calls[0];
    expect(html).toContain("Utilities (1)");
    expect(html).toContain("formatDate");
  });

  /**
   * @testdoc アイテムがない場合「アイテムがありません」を表示する
   */
  it("should show empty message when items is empty", () => {
    const data: ModulePageData = {
      type: "screen",
      moduleName: "empty",
      items: [],
      projectName: "TestProject",
    };
    generateModuleDetailPage(data, "/output/details");
    const [, html] = mockWriteFile.mock.calls[0];
    expect(html).toContain("アイテムがありません");
  });

  /**
   * @testdoc 統計情報セクションにアイテム数を表示する
   */
  it("should show item count in stats section", () => {
    const data: ModulePageData = {
      type: "screen",
      moduleName: "dashboard",
      items: [createScreen(), createScreen({ name: "SettingsPage" })],
      projectName: "TestProject",
    };
    generateModuleDetailPage(data, "/output/details");
    const [, html] = mockWriteFile.mock.calls[0];
    expect(html).toContain("統計情報");
    // 2 items
    expect(html).toContain('>2<');
  });

  /**
   * @testdoc title タグにモジュール名とプロジェクト名を含む
   */
  it("should include module name and project name in title tag", () => {
    const data: ModulePageData = {
      type: "component",
      moduleName: "shared",
      items: [],
      projectName: "MyApp",
    };
    generateModuleDetailPage(data, "/output/details");
    const [, html] = mockWriteFile.mock.calls[0];
    expect(html).toContain("shared - Component Module | MyApp");
  });
});
