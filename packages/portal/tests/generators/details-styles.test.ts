import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * details-styles ジェネレーターテスト
 *
 * 詳細ページのスタイル、スクリプト、URLユーティリティ関数をテストする。
 *
 * @testdoc 詳細ページ CSS・スクリプト・URLユーティリティの回帰テスト
 */

import {
  generateTestCaseAnchorId,
  getTestFileCategory,
  testCategoryToSlug,
  testFileToSlug,
  generateTestPageUrl,
  categoryLabels,
  getCdnScripts,
  getDetailScripts,
  getDetailStyles,
  getModuleSpecificStyles,
} from "../../src/generators/details-styles.js";

// =============================================================================
// generateTestCaseAnchorId
// =============================================================================

describe("generateTestCaseAnchorId", () => {
  /**
   * @testdoc jest フレームワークのプレフィックスを付与してアンカーIDを生成する
   */
  it("should generate anchor ID with jest prefix", () => {
    const result = generateTestCaseAnchorId("__tests__/example.test.ts", "jest");
    expect(result).toBe("jest---tests---example-test-ts");
  });

  /**
   * @testdoc playwright フレームワークのプレフィックスを付与してアンカーIDを生成する
   */
  it("should generate anchor ID with playwright prefix", () => {
    const result = generateTestCaseAnchorId("e2e/login.spec.ts", "playwright");
    expect(result).toBe("playwright-e2e-login-spec-ts");
  });

  /**
   * @testdoc 英数字以外の文字をハイフンに置換する
   */
  it("should replace non-alphanumeric characters with hyphens", () => {
    const result = generateTestCaseAnchorId("src/lib/actions/create-user.test.ts", "jest");
    expect(result).toBe("jest-src-lib-actions-create-user-test-ts");
  });
});

// =============================================================================
// getTestFileCategory
// =============================================================================

describe("getTestFileCategory", () => {
  /**
   * @testdoc playwright フレームワークの場合は E2E を返す
   */
  it("should return E2E for playwright framework", () => {
    expect(getTestFileCategory("e2e/login.spec.ts", "playwright")).toBe("E2E");
  });

  /**
   * @testdoc __tests__/lib/actions/ パスの場合は Server Actions を返す
   */
  it("should return Server Actions for __tests__/lib/actions/ path", () => {
    expect(getTestFileCategory("__tests__/lib/actions/create-user.test.ts", "jest")).toBe("Server Actions");
  });

  /**
   * @testdoc /lib/actions/ パスの場合は Server Actions を返す
   */
  it("should return Server Actions for /lib/actions/ path", () => {
    expect(getTestFileCategory("src/lib/actions/delete.test.ts", "jest")).toBe("Server Actions");
  });

  /**
   * @testdoc __tests__/components/ パスの場合は Components を返す
   */
  it("should return Components for __tests__/components/ path", () => {
    expect(getTestFileCategory("__tests__/components/Button.test.tsx", "jest")).toBe("Components");
  });

  /**
   * @testdoc /components/ パスの場合は Components を返す
   */
  it("should return Components for /components/ path", () => {
    expect(getTestFileCategory("src/components/Card.test.tsx", "jest")).toBe("Components");
  });

  /**
   * @testdoc 上記に一致しないパスの場合は Other を返す
   */
  it("should return Other for unmatched paths", () => {
    expect(getTestFileCategory("__tests__/utils/helpers.test.ts", "jest")).toBe("Other");
  });
});

// =============================================================================
// testCategoryToSlug
// =============================================================================

describe("testCategoryToSlug", () => {
  /**
   * @testdoc カテゴリ名を小文字のスラッグに変換する
   */
  it("should convert category name to lowercase slug", () => {
    expect(testCategoryToSlug("Server Actions")).toBe("server-actions");
    expect(testCategoryToSlug("E2E")).toBe("e2e");
    expect(testCategoryToSlug("Other")).toBe("other");
  });

  /**
   * @testdoc 複数スペースをハイフン1つに変換する
   */
  it("should replace multiple spaces with single hyphen", () => {
    expect(testCategoryToSlug("Some  Long  Name")).toBe("some-long-name");
  });
});

// =============================================================================
// testFileToSlug
// =============================================================================

describe("testFileToSlug", () => {
  /**
   * @testdoc .test.ts 拡張子を除去してファイル名スラッグを生成する
   */
  it("should remove .test.ts extension", () => {
    expect(testFileToSlug("__tests__/example.test.ts")).toBe("example");
  });

  /**
   * @testdoc .test.tsx 拡張子を除去してファイル名スラッグを生成する
   */
  it("should remove .test.tsx extension", () => {
    expect(testFileToSlug("src/Button.test.tsx")).toBe("Button");
  });

  /**
   * @testdoc .spec.ts 拡張子を除去してファイル名スラッグを生成する
   */
  it("should remove .spec.ts extension", () => {
    expect(testFileToSlug("e2e/login.spec.ts")).toBe("login");
  });

  /**
   * @testdoc .spec.js 拡張子を除去してファイル名スラッグを生成する
   */
  it("should remove .spec.js extension", () => {
    expect(testFileToSlug("tests/helper.spec.js")).toBe("helper");
  });

  /**
   * @testdoc パス部分を除去してファイル名のみを返す
   */
  it("should extract basename from full path", () => {
    expect(testFileToSlug("__tests__/lib/actions/create-user.test.ts")).toBe("create-user");
  });
});

// =============================================================================
// generateTestPageUrl
// =============================================================================

describe("generateTestPageUrl", () => {
  /**
   * @testdoc depth=0 でカテゴリとファイルスラッグを含むURLを生成する
   */
  it("should generate URL with category and file slug at depth 0", () => {
    const result = generateTestPageUrl("__tests__/lib/actions/create-user.test.ts", "jest", 0);
    expect(result).toBe("test-cases/server-actions/create-user.html");
  });

  /**
   * @testdoc depth=1 で ../ プレフィックス付きURLを生成する
   */
  it("should generate URL with ../ prefix at depth 1", () => {
    const result = generateTestPageUrl("__tests__/components/Button.test.tsx", "jest", 1);
    expect(result).toBe("../test-cases/components/Button.html");
  });

  /**
   * @testdoc depth=2 で ../../ プレフィックス付きURLを生成する
   */
  it("should generate URL with ../../ prefix at depth 2", () => {
    const result = generateTestPageUrl("e2e/login.spec.ts", "playwright", 2);
    expect(result).toBe("../../test-cases/e2e/login.html");
  });
});

// =============================================================================
// categoryLabels
// =============================================================================

describe("categoryLabels", () => {
  /**
   * @testdoc 全7カテゴリのラベル・アイコン・色が定義されている
   */
  it("should define labels for all 7 categories", () => {
    const categories = ["happy-path", "error-handling", "auth", "validation", "edge-case", "integration", "other"] as const;
    for (const cat of categories) {
      expect(categoryLabels[cat]).toBeDefined();
      expect(categoryLabels[cat].label).toBeTruthy();
      expect(categoryLabels[cat].icon).toBeTruthy();
      expect(categoryLabels[cat].color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  /**
   * @testdoc happy-path カテゴリが正常系ラベルと緑色を持つ
   */
  it("should have correct label and color for happy-path", () => {
    expect(categoryLabels["happy-path"].label).toBe("正常系");
    expect(categoryLabels["happy-path"].color).toBe("#22c55e");
  });
});

// =============================================================================
// getCdnScripts
// =============================================================================

describe("getCdnScripts", () => {
  /**
   * @testdoc highlight.js の CSS と JS のCDNリンクを含む
   */
  it("should include highlight.js CDN links", () => {
    const result = getCdnScripts();
    expect(result).toContain("highlight.js");
    expect(result).toContain("highlight.min.js");
    expect(result).toContain("github-dark.min.css");
  });

  /**
   * @testdoc グローバルナビの CSS と JS を含む
   */
  it("should include global nav assets", () => {
    const result = getCdnScripts();
    expect(result).toContain("global-nav.css");
    expect(result).toContain("global-nav.js");
  });
});

// =============================================================================
// getDetailScripts
// =============================================================================

describe("getDetailScripts", () => {
  /**
   * @testdoc タブ切り替えの showTab 関数を含む
   */
  it("should include showTab function", () => {
    const result = getDetailScripts();
    expect(result).toContain("function showTab(tabId)");
    expect(result).toContain("classList.add('active')");
  });

  /**
   * @testdoc highlight.js 初期化コードを含む
   */
  it("should include highlight.js initialization", () => {
    const result = getDetailScripts();
    expect(result).toContain("hljs.highlightElement");
    expect(result).toContain("DOMContentLoaded");
  });
});

// =============================================================================
// getDetailStyles
// =============================================================================

describe("getDetailStyles", () => {
  /**
   * @testdoc blue アクセントカラーで var(--accent-blue) を使用する
   */
  it("should use var(--accent-blue) for blue accent color", () => {
    const result = getDetailStyles("blue");
    expect(result).toContain("var(--accent-blue)");
  });

  /**
   * @testdoc green アクセントカラーで var(--accent-green) を使用する
   */
  it("should use var(--accent-green) for green accent color", () => {
    const result = getDetailStyles("green");
    expect(result).toContain("var(--accent-green)");
  });

  /**
   * @testdoc [details-styles/getDetailStyles] 未知のアクセントカラーでデフォルトの blue にフォールバックする
   */
  it("should fallback to blue for unknown accent color", () => {
    const result = getDetailStyles("unknown");
    expect(result).toContain("var(--accent-blue)");
  });

  /**
   * @testdoc 主要なCSSクラスを含む
   */
  it("should include key CSS classes", () => {
    const result = getDetailStyles("blue");
    expect(result).toContain(".detail-container");
    expect(result).toContain(".breadcrumb");
    expect(result).toContain(".detail-header");
    expect(result).toContain(".tab.active");
    expect(result).toContain(".section");
    expect(result).toContain(".code-block");
    expect(result).toContain(".score-bar");
    expect(result).toContain(".related-item");
  });

  /**
   * @testdoc アクセントカラーが tab.active の border-bottom-color に反映される
   */
  it("should apply accent color to tab.active border-bottom-color", () => {
    const result = getDetailStyles("orange");
    expect(result).toContain("var(--accent-orange)");
  });
});

// =============================================================================
// getModuleSpecificStyles
// =============================================================================

describe("getModuleSpecificStyles", () => {
  /**
   * @testdoc モジュールページ固有のCSSクラスを含む
   */
  it("should include module-specific CSS classes", () => {
    const result = getModuleSpecificStyles("blue");
    expect(result).toContain(".module-description");
    expect(result).toContain(".module-stats");
    expect(result).toContain(".stat-value");
    expect(result).toContain(".module-item");
    expect(result).toContain(".type-name");
    expect(result).toContain(".utility-name");
  });

  /**
   * @testdoc アクセントカラーが stat-value の色に反映される
   */
  it("should apply accent color to stat-value", () => {
    const result = getModuleSpecificStyles("pink");
    expect(result).toContain("var(--accent-pink)");
  });

  /**
   * @testdoc [details-styles/getModuleSpecificStyles] レスポンシブメディアクエリを含む
   */
  it("should include responsive media query", () => {
    const result = getModuleSpecificStyles("blue");
    expect(result).toContain("@media (max-width: 768px)");
  });

  /**
   * @testdoc [details-styles/getModuleSpecificStyles] 未知のアクセントカラーでデフォルトの blue にフォールバックする
   */
  it("should fallback to blue for unknown accent color", () => {
    const result = getModuleSpecificStyles("red");
    expect(result).toContain("var(--accent-blue)");
  });
});
