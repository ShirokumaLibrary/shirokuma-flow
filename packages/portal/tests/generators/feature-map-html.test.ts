import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * feature-map-html ジェネレーターテスト
 *
 * Feature Map HTML 生成関数（groupByModule, buildListItem, buildModuleListSection,
 * buildSummaryCard, buildScreenCard, buildComponentCard, buildActionCard, buildTableCard,
 * buildFeatureDetail, buildSidebar, buildLayerView, buildFeatureView, buildDetailPanel,
 * generateFeatureMapHtml）をテストする。
 *
 * @testdoc Feature Map HTML 生成の回帰テスト
 */

import {
  groupByModule,
  buildListItem,
  buildModuleListSection,
  buildSummaryCard,
  buildScreenCard,
  buildComponentCard,
  buildActionCard,
  buildTableCard,
  buildFeatureDetail,
  buildSidebar,
  buildLayerView,
  buildFeatureView,
  buildDetailPanel,
  generateFeatureMapHtml,
} from "../../src/generators/feature-map-html.js";
import type {
  ScreenItem,
  ComponentItem,
  ActionItem,
  TableItem,
  FeatureGroup,
  FeatureMap,
  ResolvedFeatureMapConfig,
} from "../../src/commands/feature-map-types.js";

// =============================================================================
// Helpers
// =============================================================================

function createEmptyFeatureGroup(): FeatureGroup {
  return {
    screens: [],
    components: [],
    actions: [],
    modules: [],
    tables: [],
  };
}

function createFeatureMap(overrides: Partial<FeatureMap> = {}): FeatureMap {
  return {
    features: {},
    uncategorized: createEmptyFeatureGroup(),
    moduleDescriptions: {},
    moduleTypes: {},
    moduleUtilities: {},
    generatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function createScreen(overrides: Partial<ScreenItem> = {}): ScreenItem {
  return {
    name: "DashboardPage",
    path: "src/app/dashboard/page.tsx",
    route: "/dashboard",
    description: "ダッシュボード画面",
    usedComponents: [],
    usedActions: [],
    ...overrides,
  };
}

function createComponent(overrides: Partial<ComponentItem> = {}): ComponentItem {
  return {
    name: "StatsCard",
    path: "src/components/stats/StatsCard.tsx",
    description: "統計カード",
    usedInScreens: [],
    usedInComponents: [],
    usedActions: [],
    ...overrides,
  };
}

function createAction(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    name: "createUser",
    path: "src/actions/auth/createUser.ts",
    description: "ユーザー作成",
    usedInScreens: [],
    usedInComponents: [],
    dbTables: [],
    ...overrides,
  };
}

function createTable(overrides: Partial<TableItem> = {}): TableItem {
  return {
    name: "users",
    path: "src/db/schema/users.ts",
    description: "ユーザーテーブル",
    usedInActions: [],
    ...overrides,
  };
}

function createDefaultConfig(): ResolvedFeatureMapConfig {
  return {
    enabled: true,
    include: ["src/**"],
    exclude: [],
    externalDocs: [],
  };
}

// =============================================================================
// groupByModule
// =============================================================================

describe("groupByModule", () => {
  /**
   * @testdoc アイテムをパスのモジュール名でグループ化する
   */
  it("should group items by module name extracted from path", () => {
    const items = [
      createScreen({ path: "src/app/dashboard/page.tsx" }),
      createScreen({ name: "SettingsPage", path: "src/app/settings/page.tsx" }),
      createScreen({ name: "DashboardStats", path: "src/app/dashboard/stats.tsx" }),
    ];
    const grouped = groupByModule(items);
    expect(grouped.size).toBe(2);
    expect(grouped.get("dashboard")?.length).toBe(2);
    expect(grouped.get("settings")?.length).toBe(1);
  });

  /**
   * @testdoc モジュール名をアルファベット順でソートする
   */
  it("should sort modules alphabetically", () => {
    const items = [
      createScreen({ path: "src/app/zebra/page.tsx" }),
      createScreen({ path: "src/app/alpha/page.tsx" }),
      createScreen({ path: "src/app/middle/page.tsx" }),
    ];
    const grouped = groupByModule(items);
    const keys = Array.from(grouped.keys());
    expect(keys).toEqual(["alpha", "middle", "zebra"]);
  });

  /**
   * @testdoc 空配列の場合は空のMapを返す
   */
  it("should return empty Map for empty array", () => {
    const grouped = groupByModule([]);
    expect(grouped.size).toBe(0);
  });
});

// =============================================================================
// buildListItem
// =============================================================================

describe("buildListItem", () => {
  /**
   * @testdoc screen タイプでルート情報を含むリストアイテムを生成する
   */
  it("should render screen list item with route", () => {
    const screen = createScreen({ route: "/dashboard" });
    const result = buildListItem("screen", screen, "dashboard");
    expect(result).toContain("DashboardPage");
    expect(result).toContain("item-route");
    expect(result).toContain("/dashboard");
    expect(result).toContain('href="details/screen/dashboard/DashboardPage.html"');
  });

  /**
   * @testdoc action タイプで DB テーブル数を含むリストアイテムを生成する
   */
  it("should render action list item with table count", () => {
    const action = createAction({ dbTables: ["users", "sessions"] });
    const result = buildListItem("action", action, "auth");
    expect(result).toContain("createUser");
    expect(result).toContain("2 tables");
  });

  /**
   * @testdoc 説明が60文字を超える場合に切り詰める
   */
  it("should truncate description longer than 60 characters", () => {
    const longDesc = "あ".repeat(70);
    const screen = createScreen({ description: longDesc });
    const result = buildListItem("screen", screen, "dashboard");
    expect(result).toContain("...");
  });

  /**
   * @testdoc 説明がない場合に説明スパンを含まない
   */
  it("should not include description span when description is empty", () => {
    const screen = createScreen({ description: "" });
    const result = buildListItem("screen", screen, "dashboard");
    expect(result).not.toContain("item-description");
  });
});

// =============================================================================
// buildModuleListSection
// =============================================================================

describe("buildModuleListSection", () => {
  /**
   * @testdoc アイテムが空の場合「アイテムがありません」を返す
   */
  it("should return empty message when grouped items is empty", () => {
    const result = buildModuleListSection("screen", new Map());
    expect(result).toContain("アイテムがありません");
  });

  /**
   * @testdoc モジュールグループごとにヘッダーとアイテム数を表示する
   */
  it("should render module groups with header and item count", () => {
    const grouped = new Map<string, ScreenItem[]>();
    grouped.set("dashboard", [createScreen(), createScreen({ name: "DashboardStats" })]);
    const result = buildModuleListSection("screen", grouped);
    expect(result).toContain("module-group");
    expect(result).toContain("dashboard");
    expect(result).toContain("2");
  });

  /**
   * @testdoc モジュール説明がある場合に表示する
   */
  it("should show module description when provided", () => {
    const grouped = new Map<string, ScreenItem[]>();
    grouped.set("dashboard", [createScreen()]);
    const descriptions = new Map([["dashboard", "ダッシュボードモジュール"]]);
    const result = buildModuleListSection("screen", grouped, descriptions);
    expect(result).toContain("module-description");
  });

  /**
   * @testdoc モジュール詳細ページへのリンクを生成する
   */
  it("should generate link to module detail page", () => {
    const grouped = new Map<string, ScreenItem[]>();
    grouped.set("dashboard", [createScreen()]);
    const result = buildModuleListSection("screen", grouped);
    expect(result).toContain('href="details/screen/dashboard.html"');
  });
});

// =============================================================================
// buildSummaryCard
// =============================================================================

describe("buildSummaryCard", () => {
  /**
   * @testdoc Features, Screens, Components, Actions, Tables の合計を表示する
   */
  it("should display totals for all item types", () => {
    const featureMap = createFeatureMap({
      features: {
        auth: {
          screens: [createScreen()],
          components: [createComponent(), createComponent({ name: "LoginForm" })],
          actions: [createAction()],
          modules: [],
          tables: [createTable()],
        },
      },
      uncategorized: {
        screens: [createScreen({ name: "HomePage" })],
        components: [],
        actions: [],
        modules: [],
        tables: [],
      },
    });
    const result = buildSummaryCard(featureMap);
    expect(result).toContain("summary-card");
    // 1 feature
    expect(result).toMatch(/summary-features[\s\S]*?1/);
    // 2 screens (1 in auth + 1 uncategorized)
    expect(result).toMatch(/summary-screens[\s\S]*?2/);
    // 2 components
    expect(result).toMatch(/summary-components[\s\S]*?2/);
    // 1 action
    expect(result).toMatch(/summary-actions[\s\S]*?1/);
    // 1 table
    expect(result).toMatch(/summary-tables[\s\S]*?1/);
  });

  /**
   * @testdoc 生成日時を日本語ロケールで表示する
   */
  it("should display generated date", () => {
    const featureMap = createFeatureMap();
    const result = buildSummaryCard(featureMap);
    expect(result).toContain("生成日時:");
  });
});

// =============================================================================
// Card builders
// =============================================================================

describe("buildScreenCard", () => {
  /**
   * @testdoc Screen カードにルート情報とコンポーネント数を含む
   */
  it("should render screen card with route and component count", () => {
    const screen = createScreen({
      route: "/dashboard",
      usedComponents: ["StatsCard", "Chart"],
      usedActions: ["fetchStats"],
    });
    const result = buildScreenCard(screen);
    expect(result).toContain("DashboardPage");
    expect(result).toContain("/dashboard");
    expect(result).toContain("2 components");
    expect(result).toContain("1 actions");
    expect(result).toContain("card-type-badge screen");
  });

  /**
   * @testdoc 詳細ページへの正しいリンクを生成する
   */
  it("should generate correct detail page link", () => {
    const screen = createScreen({ path: "src/app/dashboard/page.tsx" });
    const result = buildScreenCard(screen);
    expect(result).toContain('href="details/screens/dashboard/DashboardPage.html"');
  });
});

describe("buildComponentCard", () => {
  /**
   * @testdoc Component カードに使用画面数を含む
   */
  it("should render component card with screen count", () => {
    const comp = createComponent({
      usedInScreens: ["Dashboard"],
      usedActions: ["fetchData"],
    });
    const result = buildComponentCard(comp);
    expect(result).toContain("StatsCard");
    expect(result).toContain("1 screens");
    expect(result).toContain("1 actions");
    expect(result).toContain("card-type-badge component");
  });
});

describe("buildActionCard", () => {
  /**
   * @testdoc Action カードに DB テーブル数を含む
   */
  it("should render action card with table count", () => {
    const action = createAction({
      usedInScreens: ["Dashboard"],
      dbTables: ["users", "sessions"],
    });
    const result = buildActionCard(action);
    expect(result).toContain("createUser");
    expect(result).toContain("1 screens");
    expect(result).toContain("2 tables");
    expect(result).toContain("card-type-badge action");
  });
});

describe("buildTableCard", () => {
  /**
   * @testdoc Table カードに使用アクション数を含む
   */
  it("should render table card with action count", () => {
    const table = createTable({
      usedInActions: ["createUser", "deleteUser"],
    });
    const result = buildTableCard(table);
    expect(result).toContain("users");
    expect(result).toContain("2 actions");
    expect(result).toContain("card-type-badge table");
  });
});

// =============================================================================
// buildFeatureDetail
// =============================================================================

describe("buildFeatureDetail", () => {
  /**
   * @testdoc Feature 名とアイテム数のサマリーバッジを表示する
   */
  it("should render feature name and summary badges", () => {
    const group: FeatureGroup = {
      screens: [createScreen()],
      components: [createComponent()],
      actions: [createAction(), createAction({ name: "deleteUser" })],
      modules: [],
      tables: [],
    };
    const featureMap = createFeatureMap({ features: { auth: group } });
    const result = buildFeatureDetail("auth", group, featureMap);
    expect(result).toContain("auth");
    expect(result).toContain("1 screens");
    expect(result).toContain("1 components");
    expect(result).toContain("2 actions");
    expect(result).toContain("0 tables");
  });

  /**
   * @testdoc アイテムがあるセクションのみ表示する
   */
  it("should only render sections for non-empty item types", () => {
    const group: FeatureGroup = {
      screens: [createScreen()],
      components: [],
      actions: [],
      modules: [],
      tables: [],
    };
    const featureMap = createFeatureMap({ features: { auth: group } });
    const result = buildFeatureDetail("auth", group, featureMap);
    expect(result).toContain("Screens (1)");
    expect(result).not.toContain("Components (");
    expect(result).not.toContain("Actions (");
    expect(result).not.toContain("Tables (");
  });
});

// =============================================================================
// buildDetailPanel
// =============================================================================

describe("buildDetailPanel", () => {
  /**
   * @testdoc Feature がない場合にウェルカムメッセージを表示する
   */
  it("should show welcome message when no features exist", () => {
    const featureMap = createFeatureMap();
    const result = buildDetailPanel(featureMap);
    expect(result).toContain("機能マップへようこそ");
  });

  /**
   * @testdoc Feature がある場合に最初の Feature の詳細を表示する
   */
  it("should show first feature detail when features exist", () => {
    const featureMap = createFeatureMap({
      features: {
        auth: {
          screens: [createScreen()],
          components: [],
          actions: [],
          modules: [],
          tables: [],
        },
      },
    });
    const result = buildDetailPanel(featureMap);
    expect(result).toContain("auth");
    expect(result).toContain("1 screens");
  });
});

// =============================================================================
// buildLayerView
// =============================================================================

describe("buildLayerView", () => {
  /**
   * @testdoc 5つのレイヤー（Features, Screens, Components, Actions, Tables）を表示する
   */
  it("should render all five layer groups", () => {
    const featureMap = createFeatureMap({
      features: { auth: createEmptyFeatureGroup() },
    });
    const result = buildLayerView(featureMap);
    expect(result).toContain("Features");
    expect(result).toContain("Screens");
    expect(result).toContain("Components");
    expect(result).toContain("Actions");
    expect(result).toContain("Tables");
  });

  /**
   * @testdoc 各レイヤーのアイテム数を表示する
   */
  it("should show item counts for each layer", () => {
    const featureMap = createFeatureMap({
      features: {
        auth: {
          screens: [createScreen()],
          components: [createComponent()],
          actions: [],
          modules: [],
          tables: [],
        },
      },
    });
    const result = buildLayerView(featureMap);
    // 1 feature
    expect(result).toContain('data-group="features"');
    // Sidebar items for screen
    expect(result).toContain('data-type="screen"');
    expect(result).toContain("DashboardPage");
  });
});

// =============================================================================
// buildFeatureView
// =============================================================================

describe("buildFeatureView", () => {
  /**
   * @testdoc 各 Feature のアイテムをグループ化して表示する
   */
  it("should render feature groups with items", () => {
    const featureMap = createFeatureMap({
      features: {
        auth: {
          screens: [createScreen()],
          components: [],
          actions: [createAction()],
          modules: [],
          tables: [],
        },
      },
    });
    const result = buildFeatureView(featureMap);
    expect(result).toContain("auth");
    expect(result).toContain("DashboardPage");
    expect(result).toContain("createUser");
  });

  /**
   * @testdoc 未分類アイテムがある場合に「未分類」セクションを表示する
   */
  it("should render uncategorized section when uncategorized items exist", () => {
    const featureMap = createFeatureMap({
      uncategorized: {
        screens: [createScreen({ name: "OrphanPage" })],
        components: [],
        actions: [],
        modules: [],
        tables: [],
      },
    });
    const result = buildFeatureView(featureMap);
    expect(result).toContain("未分類");
    expect(result).toContain("OrphanPage");
  });

  /**
   * @testdoc 未分類アイテムがない場合に「未分類」セクションを表示しない
   */
  it("should not render uncategorized section when no uncategorized items", () => {
    const featureMap = createFeatureMap();
    const result = buildFeatureView(featureMap);
    expect(result).not.toContain("未分類");
  });
});

// =============================================================================
// buildSidebar
// =============================================================================

describe("buildSidebar", () => {
  /**
   * @testdoc レイヤービューと機能ビューの両方を含む
   */
  it("should contain both layer view and feature view", () => {
    const featureMap = createFeatureMap();
    const result = buildSidebar(featureMap);
    expect(result).toContain('id="layerView"');
    expect(result).toContain('id="featureView"');
  });
});

// =============================================================================
// generateFeatureMapHtml
// =============================================================================

describe("generateFeatureMapHtml", () => {
  /**
   * @testdoc [feature-map-html] 完全な HTML ドキュメントを生成する
   */
  it("should generate a complete HTML document", () => {
    const featureMap = createFeatureMap({
      features: {
        auth: {
          screens: [createScreen()],
          components: [],
          actions: [createAction()],
          modules: [],
          tables: [],
        },
      },
    });
    const result = generateFeatureMapHtml(featureMap, "TestProject", createDefaultConfig());
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("<html");
    expect(result).toContain("</html>");
  });

  /**
   * @testdoc プロジェクト名を含むタイトルを生成する
   */
  it("should include project name in title", () => {
    const featureMap = createFeatureMap();
    const result = generateFeatureMapHtml(featureMap, "MyApp", createDefaultConfig());
    expect(result).toContain("機能階層マップ - MyApp");
  });

  /**
   * @testdoc フィルタータブに各タイプのアイテム数を表示する
   */
  it("should show filter tabs with item counts", () => {
    const featureMap = createFeatureMap({
      features: {
        auth: {
          screens: [createScreen(), createScreen({ name: "LoginPage" })],
          components: [],
          actions: [createAction()],
          modules: [],
          tables: [],
        },
      },
    });
    const result = generateFeatureMapHtml(featureMap, "TestProject", createDefaultConfig());
    expect(result).toContain("Screens (2)");
    expect(result).toContain("Actions (1)");
    expect(result).toContain("Tables (0)");
  });

  /**
   * @testdoc サマリーカードを含む
   */
  it("should include summary card", () => {
    const featureMap = createFeatureMap({
      features: { auth: createEmptyFeatureGroup() },
    });
    const result = generateFeatureMapHtml(featureMap, "TestProject", createDefaultConfig());
    expect(result).toContain("summary-card");
  });

  /**
   * @testdoc モジュール別リストパネルを各タイプに対して生成する
   */
  it("should generate list panels for each type", () => {
    const featureMap = createFeatureMap();
    const result = generateFeatureMapHtml(featureMap, "TestProject", createDefaultConfig());
    expect(result).toContain('id="panel-screen"');
    expect(result).toContain('id="panel-component"');
    expect(result).toContain('id="panel-action"');
    expect(result).toContain('id="panel-table"');
  });

  /**
   * @testdoc JSON エクスポートリンクを含む
   */
  it("should include JSON export link", () => {
    const featureMap = createFeatureMap();
    const result = generateFeatureMapHtml(featureMap, "TestProject", createDefaultConfig());
    expect(result).toContain("feature-map.json");
    expect(result).toContain("JSONエクスポート");
  });
});
