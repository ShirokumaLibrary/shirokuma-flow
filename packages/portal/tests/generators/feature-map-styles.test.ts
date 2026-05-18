import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * feature-map-styles ジェネレーターテスト
 *
 * feature-map 用の設定解決、ファイル収集、CSS、JavaScript 生成をテストする。
 *
 * @testdoc Feature Map スタイル・設定・ファイル収集の回帰テスト
 */

import type { FeatureMap, ResolvedFeatureMapConfig } from "../../src/commands/feature-map-types.js";

// globSync のモック設定（ESM）
const mockGlobSync = vi.fn();

vi.mock("glob", () => ({
  globSync: mockGlobSync,
}));

const {
  getDefaultFeatureMapConfig,
  resolveFeatureMapConfig,
  collectFiles,
  getStyles,
  getScripts,
} = await import("../../src/generators/feature-map-styles.js");

afterEach(() => {
  vi.restoreAllMocks();
  mockGlobSync.mockReset();
});

// =============================================================================
// Helpers
// =============================================================================

function createMinimalFeatureMap(): FeatureMap {
  return {
    features: {},
    uncategorized: {
      screens: [],
      components: [],
      actions: [],
      tables: [],
      modules: [],
    },
    moduleDescriptions: {},
    moduleTypes: {},
    moduleUtilities: {},
    generatedAt: "2026-01-01T00:00:00.000Z",
  };
}

// =============================================================================
// getDefaultFeatureMapConfig
// =============================================================================

describe("getDefaultFeatureMapConfig", () => {
  /**
   * @testdoc デフォルト設定で enabled=true を返す
   */
  it("should return enabled=true by default", () => {
    const config = getDefaultFeatureMapConfig();
    expect(config.enabled).toBe(true);
  });

  /**
   * @testdoc デフォルトの include パターンに apps glob を含む
   */
  it("should include apps glob patterns in defaults", () => {
    const config = getDefaultFeatureMapConfig();
    expect(config.include).toContain("apps/*/app/**/*.tsx");
    expect(config.include).toContain("apps/*/components/**/*.tsx");
    expect(config.include).toContain("apps/*/lib/actions/**/*.ts");
  });

  /**
   * @testdoc デフォルトの exclude パターンに node_modules とテストファイルを含む
   */
  it("should exclude node_modules and test files by default", () => {
    const config = getDefaultFeatureMapConfig();
    expect(config.exclude).toContain("**/node_modules/**");
    expect(config.exclude).toContain("**/*.test.ts");
    expect(config.exclude).toContain("**/*.test.tsx");
  });

  /**
   * @testdoc デフォルトで storybook は undefined を返す
   */
  it("should return undefined storybook by default", () => {
    const config = getDefaultFeatureMapConfig();
    expect(config.storybook).toBeUndefined();
  });

  /**
   * @testdoc デフォルトで externalDocs は空配列を返す
   */
  it("should return empty externalDocs by default", () => {
    const config = getDefaultFeatureMapConfig();
    expect(config.externalDocs).toEqual([]);
  });
});

// =============================================================================
// resolveFeatureMapConfig
// =============================================================================

describe("resolveFeatureMapConfig", () => {
  /**
   * @testdoc 引数なしでデフォルト設定を返す
   */
  it("should return default config when no argument provided", () => {
    const config = resolveFeatureMapConfig();
    const defaults = getDefaultFeatureMapConfig();
    expect(config.enabled).toBe(defaults.enabled);
    expect(config.include).toEqual(defaults.include);
    expect(config.exclude).toEqual(defaults.exclude);
  });

  /**
   * @testdoc include のみオーバーライドした場合、他はデフォルト値を保持する
   */
  it("should override only specified fields", () => {
    const config = resolveFeatureMapConfig({
      include: ["custom/**/*.ts"],
    });
    expect(config.include).toEqual(["custom/**/*.ts"]);
    expect(config.exclude).toEqual(getDefaultFeatureMapConfig().exclude);
    expect(config.enabled).toBe(true);
  });

  /**
   * @testdoc enabled=false を指定した場合に反映する
   */
  it("should respect enabled=false", () => {
    const config = resolveFeatureMapConfig({ enabled: false });
    expect(config.enabled).toBe(false);
  });

  /**
   * @testdoc storybook.enabled=true の場合にデフォルト値で StorybookConfig を生成する
   */
  it("should create storybook config with defaults when enabled", () => {
    const config = resolveFeatureMapConfig({
      storybook: { enabled: true },
    });
    expect(config.storybook).toBeDefined();
    expect(config.storybook!.enabled).toBe(true);
    expect(config.storybook!.url).toBe("http://localhost:6006");
    expect(config.storybook!.pathTemplate).toBe("?path=/docs/{name}--docs");
    expect(config.storybook!.label).toBe("Storybook");
  });

  /**
   * @testdoc storybook のカスタム値を適用する
   */
  it("should apply custom storybook values", () => {
    const config = resolveFeatureMapConfig({
      storybook: {
        enabled: true,
        url: "http://localhost:9009",
        label: "Stories",
      },
    });
    expect(config.storybook!.url).toBe("http://localhost:9009");
    expect(config.storybook!.label).toBe("Stories");
  });

  /**
   * @testdoc storybook.enabled=false の場合は storybook を undefined にする
   */
  it("should leave storybook undefined when not enabled", () => {
    const config = resolveFeatureMapConfig({
      storybook: { enabled: false },
    });
    expect(config.storybook).toBeUndefined();
  });
});

// =============================================================================
// collectFiles
// =============================================================================

describe("collectFiles", () => {
  /**
   * @testdoc include パターンごとに globSync を呼び出す
   */
  it("should call globSync for each include pattern", () => {
    mockGlobSync.mockReturnValue([]);
    const config = resolveFeatureMapConfig({
      include: ["pattern1", "pattern2"],
      exclude: ["**/node_modules/**"],
    });

    collectFiles("/project", config);
    expect(mockGlobSync).toHaveBeenCalledTimes(2);
  });

  /**
   * @testdoc globSync に正しい cwd と absolute オプションを渡す
   */
  it("should pass correct cwd and absolute options to globSync", () => {
    mockGlobSync.mockReturnValue([]);
    const config = resolveFeatureMapConfig({
      include: ["**/*.ts"],
      exclude: [],
    });

    collectFiles("/my/project", config);
    expect(mockGlobSync).toHaveBeenCalledWith("**/*.ts", {
      cwd: "/my/project",
      absolute: true,
      ignore: [],
    });
  });

  /**
   * @testdoc 重複ファイルを排除してソートされた配列を返す
   */
  it("should deduplicate and sort results", () => {
    mockGlobSync
      .mockReturnValueOnce(["/project/b.ts", "/project/a.ts"])
      .mockReturnValueOnce(["/project/a.ts", "/project/c.ts"]);

    const config = resolveFeatureMapConfig({
      include: ["pattern1", "pattern2"],
      exclude: [],
    });

    const result = collectFiles("/project", config);
    expect(result).toEqual(["/project/a.ts", "/project/b.ts", "/project/c.ts"]);
  });

  /**
   * @testdoc ファイルがない場合は空配列を返す
   */
  it("should return empty array when no files found", () => {
    mockGlobSync.mockReturnValue([]);
    const config = resolveFeatureMapConfig({ include: ["**/*.ts"], exclude: [] });
    const result = collectFiles("/project", config);
    expect(result).toEqual([]);
  });
});

// =============================================================================
// getStyles
// =============================================================================

describe("getStyles", () => {
  /**
   * @testdoc コンテナとサマリーカードのCSSクラスを含む
   */
  it("should include container and summary card CSS classes", () => {
    const result = getStyles();
    expect(result).toContain(".container");
    expect(result).toContain(".summary-card");
    expect(result).toContain(".summary-grid");
  });

  /**
   * @testdoc フィルタータブとリストパネルのスタイルを含む
   */
  it("should include filter tab and list panel styles", () => {
    const result = getStyles();
    expect(result).toContain(".filter-tab");
    expect(result).toContain(".list-panel");
    expect(result).toContain(".filter-tab.active");
  });

  /**
   * @testdoc モジュールグループとリストアイテムのスタイルを含む
   */
  it("should include module group and list item styles", () => {
    const result = getStyles();
    expect(result).toContain(".module-group");
    expect(result).toContain(".module-header");
    expect(result).toContain(".list-item");
    expect(result).toContain(".item-name");
  });

  /**
   * @testdoc 5列グリッドレイアウトを含む
   */
  it("should include 5-column grid layout", () => {
    const result = getStyles();
    expect(result).toContain("repeat(5, 1fr)");
  });

  /**
   * @testdoc レスポンシブメディアクエリを含む（1200px, 768px, 480px）
   */
  it("should include responsive media queries", () => {
    const result = getStyles();
    expect(result).toContain("@media (max-width: 1200px)");
    expect(result).toContain("@media (max-width: 768px)");
    expect(result).toContain("@media (max-width: 480px)");
  });

  /**
   * @testdoc カテゴリ別のサマリー色を含む
   */
  it("should include category-specific summary colors", () => {
    const result = getStyles();
    expect(result).toContain(".summary-features");
    expect(result).toContain(".summary-screens");
    expect(result).toContain(".summary-components");
    expect(result).toContain(".summary-actions");
    expect(result).toContain(".summary-tables");
  });
});

// =============================================================================
// getScripts
// =============================================================================

describe("getScripts", () => {
  /**
   * @testdoc タブ切り替えのイベントリスナーを含む
   */
  it("should include tab switching event listener", () => {
    const featureMap = createMinimalFeatureMap();
    const config = resolveFeatureMapConfig();
    const result = getScripts(featureMap, config);
    expect(result).toContain("filterTabs");
    expect(result).toContain("addEventListener");
    expect(result).toContain("classList.add('active')");
  });

  /**
   * @testdoc リストパネルの表示切り替えロジックを含む
   */
  it("should include list panel switching logic", () => {
    const featureMap = createMinimalFeatureMap();
    const config = resolveFeatureMapConfig();
    const result = getScripts(featureMap, config);
    expect(result).toContain("listPanels");
    expect(result).toContain("dataset.type");
    expect(result).toContain("dataset.filter");
  });
});
