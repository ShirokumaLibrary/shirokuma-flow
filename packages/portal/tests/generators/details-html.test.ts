import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * details-html ジェネレーターテスト
 *
 * 詳細ページの HTML 生成関数（generateDetailHTML, generateJSDocSection,
 * getTagLabel, generateTestSectionHTML）をテストする。
 *
 * @testdoc 詳細ページ HTML 生成の回帰テスト
 */

import {
  generateDetailHTML,
  generateJSDocSection,
  getTagLabel,
  generateTestSectionHTML,
} from "../../src/generators/details-html.js";
import type {
  DetailHTMLData,
  DetailsContext,
  CategorizedTestCase,
  TestCoverageAnalysis,
  TestCategory,
} from "../../src/commands/details-types.js";

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
    recommendations: ["テストを追加してください"],
  };
}

function createTestCase(overrides: Partial<CategorizedTestCase> = {}): CategorizedTestCase {
  return {
    file: "__tests__/example.test.ts",
    describe: "Example",
    it: "should work",
    line: 10,
    framework: "jest",
    category: "happy-path",
    summary: "正常系テスト",
    ...overrides,
  };
}

function createMinimalHTMLData(overrides: Partial<DetailHTMLData> = {}): DetailHTMLData {
  return {
    type: "screen",
    name: "DashboardPage",
    moduleName: "dashboard",
    description: "ダッシュボード画面",
    filePath: "src/app/dashboard/page.tsx",
    code: "export default function DashboardPage() {}",
    jsDoc: "",
    testCases: [],
    testAnalysis: createEmptyAnalysis(),
    related: [],
    projectName: "TestProject",
    ...overrides,
  };
}

// =============================================================================
// getTagLabel
// =============================================================================

describe("getTagLabel", () => {
  /**
   * @testdoc 既知のタグ名を日本語ラベルに変換する
   */
  it("should return label for known tag names", () => {
    expect(getTagLabel("serverAction")).toBe("🚀 Server Action");
    expect(getTagLabel("feature")).toBe("📦 機能");
    expect(getTagLabel("dbTables")).toBe("🗄️ DB");
    expect(getTagLabel("module")).toBe("📁 モジュール");
  });

  /**
   * @testdoc 未知のタグ名は @タグ名 形式で返す
   */
  it("should return @tagName format for unknown tags", () => {
    expect(getTagLabel("customTag")).toBe("@customTag");
    expect(getTagLabel("unknown")).toBe("@unknown");
  });
});

// =============================================================================
// generateJSDocSection
// =============================================================================

describe("generateJSDocSection", () => {
  /**
   * @testdoc JSDocが空でフォールバック説明もない場合「説明はありません」を返す
   */
  it("should return no-description message when both jsDoc and fallback are empty", () => {
    const result = generateJSDocSection("", "");
    expect(result).toContain("説明はありません");
  });

  /**
   * @testdoc フォールバック説明がある場合に概要セクションを生成する
   */
  it("should generate overview section from fallback description", () => {
    const result = generateJSDocSection("", "フォールバック説明文");
    expect(result).toContain("概要");
    expect(result).toContain("フォールバック説明文");
  });

  /**
   * @testdoc JSDoc の @param タグからパラメータテーブルを生成する
   */
  it("should generate params table from @param tags", () => {
    const jsDoc = "テスト関数\n@param {string} name - ユーザー名\n@param {number} age - 年齢";
    const result = generateJSDocSection(jsDoc, "");
    expect(result).toContain("パラメータ");
    expect(result).toContain("name");
    expect(result).toContain("age");
  });

  /**
   * @testdoc JSDoc の @returns タグから戻り値セクションを生成する
   */
  it("should generate returns section from @returns tag", () => {
    const jsDoc = "テスト関数\n@returns {string} 結果文字列";
    const result = generateJSDocSection(jsDoc, "");
    expect(result).toContain("戻り値");
    expect(result).toContain("結果文字列");
  });

  /**
   * @testdoc JSDoc の @throws タグから例外セクションを生成する
   */
  it("should generate throws section from @throws tag", () => {
    const jsDoc = "テスト関数\n@throws {Error} バリデーションエラー";
    const result = generateJSDocSection(jsDoc, "");
    expect(result).toContain("例外");
    expect(result).toContain("バリデーションエラー");
  });

  /**
   * @testdoc JSDoc の @example タグから使用例セクションを生成する
   */
  it("should generate examples section from @example tag", () => {
    const jsDoc = "テスト関数\n@example\nconst result = test();";
    const result = generateJSDocSection(jsDoc, "");
    expect(result).toContain("使用例");
  });

  /**
   * @testdoc メタ情報タグ（serverAction, feature 等）からメタ情報セクションを生成する
   */
  it("should generate meta tags section for known meta tags", () => {
    const jsDoc = "テスト関数\n@serverAction createUser\n@feature ユーザー管理";
    const result = generateJSDocSection(jsDoc, "");
    expect(result).toContain("メタ情報");
    expect(result).toContain("Server Action");
  });
});

// =============================================================================
// generateTestSectionHTML
// =============================================================================

describe("generateTestSectionHTML", () => {
  /**
   * @testdoc テストケースが空の場合「テストケースが見つかりませんでした」を表示する
   */
  it("should show no-tests message when testCases is empty", () => {
    const analysis = createEmptyAnalysis();
    const result = generateTestSectionHTML([], analysis, "blue");
    expect(result).toContain("テストケースが見つかりませんでした");
    expect(result).toContain("テストを追加してください");
  });

  /**
   * @testdoc テストケースがある場合にカバレッジスコアとテストリストを表示する
   */
  it("should show coverage score and test list when testCases exist", () => {
    const tc = createTestCase({ description: "ダッシュボード表示テスト" });
    const analysis: TestCoverageAnalysis = {
      totalTests: 1,
      byCategory: {
        "happy-path": [tc],
        "error-handling": [],
        auth: [],
        validation: [],
        "edge-case": [],
        integration: [],
        other: [],
      },
      missingPatterns: [],
      coverageScore: 80,
      recommendations: [],
    };

    const result = generateTestSectionHTML([tc], analysis, "blue");
    expect(result).toContain("テストカバレッジ");
    expect(result).toContain("80%");
    expect(result).toContain("ダッシュボード表示テスト");
    expect(result).toContain("テストケース (1件)");
  });

  /**
   * @testdoc カバレッジスコア70以上で緑色を使用する
   */
  it("should use green color for coverage score >= 70", () => {
    const tc = createTestCase();
    const analysis: TestCoverageAnalysis = {
      ...createEmptyAnalysis(),
      totalTests: 1,
      byCategory: { ...createEmptyAnalysis().byCategory, "happy-path": [tc] },
      coverageScore: 75,
    };

    const result = generateTestSectionHTML([tc], analysis, "blue");
    expect(result).toContain("#22c55e");
  });

  /**
   * @testdoc カバレッジスコア40未満で赤色を使用する
   */
  it("should use red color for coverage score < 40", () => {
    const tc = createTestCase();
    const analysis: TestCoverageAnalysis = {
      ...createEmptyAnalysis(),
      totalTests: 1,
      byCategory: { ...createEmptyAnalysis().byCategory, "happy-path": [tc] },
      coverageScore: 30,
    };

    const result = generateTestSectionHTML([tc], analysis, "blue");
    expect(result).toContain("#ef4444");
  });

  /**
   * @testdoc 不足テストパターンがある場合にバッジを表示する
   */
  it("should show missing patterns when present", () => {
    const tc = createTestCase();
    const analysis: TestCoverageAnalysis = {
      ...createEmptyAnalysis(),
      totalTests: 1,
      byCategory: { ...createEmptyAnalysis().byCategory, "happy-path": [tc] },
      coverageScore: 50,
      missingPatterns: ["error-handling", "validation"],
    };

    const result = generateTestSectionHTML([tc], analysis, "blue");
    expect(result).toContain("不足しているテスト");
    expect(result).toContain("error-handling");
    expect(result).toContain("validation");
  });

  /**
   * @testdoc BDD アノテーション付きテストケースを表示する
   */
  it("should render BDD annotations when present", () => {
    const tc = createTestCase({
      bdd: {
        given: "ユーザーがログイン済み",
        when: "ダッシュボードにアクセス",
        then: "統計情報が表示される",
      },
    });
    const analysis: TestCoverageAnalysis = {
      ...createEmptyAnalysis(),
      totalTests: 1,
      byCategory: { ...createEmptyAnalysis().byCategory, "happy-path": [tc] },
      coverageScore: 50,
    };

    const result = generateTestSectionHTML([tc], analysis, "blue");
    expect(result).toContain("Given");
    expect(result).toContain("ユーザーがログイン済み");
    expect(result).toContain("When");
    expect(result).toContain("ダッシュボードにアクセス");
    expect(result).toContain("Then");
    expect(result).toContain("統計情報が表示される");
  });
});

// =============================================================================
// generateDetailHTML
// =============================================================================

describe("generateDetailHTML", () => {
  /**
   * @testdoc 完全な HTML ドキュメントを生成する（DOCTYPE, html, head, body を含む）
   */
  it("should generate a complete HTML document", () => {
    const data = createMinimalHTMLData();
    const ctx = createEmptyContext();
    const result = generateDetailHTML(data, ctx);
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("<html");
    expect(result).toContain("</html>");
  });

  /**
   * @testdoc ページタイトルにモジュールプレフィックスと要素名を含む
   */
  it("should include module prefix and element name in page title", () => {
    const data = createMinimalHTMLData();
    const ctx = createEmptyContext();
    const result = generateDetailHTML(data, ctx);
    expect(result).toContain("dashboard/");
    expect(result).toContain("DashboardPage");
  });

  /**
   * @testdoc ページヘッダーにモジュールプレフィックスとファイルパスを含む
   */
  it("should include page header with module prefix and file path", () => {
    const data = createMinimalHTMLData();
    const ctx = createEmptyContext();
    const result = generateDetailHTML(data, ctx);
    expect(result).toContain("page-header");
    expect(result).toContain("page-module-prefix");
    expect(result).toContain("src/app/dashboard/page.tsx");
  });

  /**
   * @testdoc 4つのタブ（概要、コード、テスト、関連）を生成する
   */
  it("should generate four tabs: overview, code, tests, related", () => {
    const data = createMinimalHTMLData();
    const ctx = createEmptyContext();
    const result = generateDetailHTML(data, ctx);
    expect(result).toContain("概要");
    expect(result).toContain("コード");
    expect(result).toContain("テスト");
    expect(result).toContain("関連");
  });

  /**
   * @testdoc action タイプの場合にアクション種別バッジを表示する
   */
  it("should show action type badge for action type", () => {
    const data = createMinimalHTMLData({
      type: "action",
      name: "createUser",
      actionType: "CRUD",
    });
    const ctx = createEmptyContext();
    const result = generateDetailHTML(data, ctx);
    expect(result).toContain("CRUD");
    expect(result).toContain("badge-teal");
  });

  /**
   * @testdoc 関連要素のリンクを生成する（コンテキストに要素が存在する場合）
   */
  it("should generate related element links when context has matching elements", () => {
    const ctx = createEmptyContext();
    ctx.existingElements.components.set("dashboard/StatsCard", "dashboard");

    const data = createMinimalHTMLData({
      related: [
        { type: "Components", items: ["dashboard/StatsCard"], linkType: "component" },
      ],
    });
    const result = generateDetailHTML(data, ctx);
    expect(result).toContain("related-group");
    expect(result).toContain("Components");
  });

  /**
   * @testdoc ルート情報がある場合にメタ情報に含める
   */
  it("should include route information in meta when present", () => {
    const data = createMinimalHTMLData({ route: "/dashboard" });
    const ctx = createEmptyContext();
    const result = generateDetailHTML(data, ctx);
    expect(result).toContain("Route:");
    expect(result).toContain("/dashboard");
  });

  /**
   * @testdoc title タグにプロジェクト名を含む
   */
  it("should include project name in title tag", () => {
    const data = createMinimalHTMLData({ projectName: "MyApp" });
    const ctx = createEmptyContext();
    const result = generateDetailHTML(data, ctx);
    expect(result).toContain("DashboardPage - Screen | MyApp");
  });

  /**
   * @testdoc パンくずナビゲーションが HTML に含まれる
   */
  it("should include breadcrumb navigation in generated HTML", () => {
    const data = createMinimalHTMLData();
    const ctx = createEmptyContext();
    const result = generateDetailHTML(data, ctx);
    expect(result).toContain('<nav class="breadcrumb"');
    expect(result).toContain("Portal");
    expect(result).toContain("Screens");
    expect(result).toContain("breadcrumb-module");
    expect(result).toContain("dashboard");
    expect(result).toContain("DashboardPage");
  });
});
