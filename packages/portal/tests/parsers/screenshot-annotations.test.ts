import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Screenshot Annotations Parser Tests
 *
 * Tests for parsing @screenshot annotations from page.tsx files.
 *
 * @testdoc page.tsxファイルから@screenshotアノテーションを解析する
 */

import {
  parseScreenshotAnnotations,
  ScreenshotAnnotation,
  scanFilesForScreenshots,
} from "../../src/parsers/screenshot-annotations.js";

describe("parseScreenshotAnnotations", () => {
  const defaultFilePath = "apps/web/app/[locale]/(dashboard)/[orgSlug]/page.tsx";

  /**
   * @testdoc 基本的な@screenshotアノテーションを解析できる
   * @purpose 最小限のアノテーション解析
   */
  it("should parse basic @screenshot annotation", () => {
    const content = `
/**
 * Organization Dashboard Page
 * @screen OrganizationDashboardScreen
 * @screenshot
 */
export default function Page() {}
`;
    const result = parseScreenshotAnnotations(content, defaultFilePath);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("OrganizationDashboardScreen");
    expect(result!.enabled).toBe(true);
  });

  /**
   * @testdoc @screenshotがないページはnullを返す
   * @purpose アノテーションなしのページを無視
   */
  it("should return null when @screenshot is not present", () => {
    const content = `
/**
 * Organization Dashboard Page
 * @screen OrganizationDashboardScreen
 */
export default function Page() {}
`;
    const result = parseScreenshotAnnotations(content, defaultFilePath);
    expect(result).toBeNull();
  });

  /**
   * @testdoc @screenshot-viewportを解析できる
   * @purpose カスタムビューポートサイズの解析
   */
  it("should parse @screenshot-viewport annotation", () => {
    const content = `
/**
 * Wide Page
 * @screen WidePage
 * @screenshot
 * @screenshot-viewport 1920x1080
 */
export default function Page() {}
`;
    const result = parseScreenshotAnnotations(content, defaultFilePath);
    expect(result).not.toBeNull();
    expect(result!.viewport).toEqual({ width: 1920, height: 1080 });
  });

  /**
   * @testdoc 無効な@screenshot-viewportフォーマットは無視する
   * @purpose 不正なビューポート指定のハンドリング
   */
  it("should ignore invalid viewport format", () => {
    const content = `
/**
 * Page
 * @screen TestPage
 * @screenshot
 * @screenshot-viewport invalid
 */
export default function Page() {}
`;
    const result = parseScreenshotAnnotations(content, defaultFilePath);
    expect(result).not.toBeNull();
    expect(result!.viewport).toBeUndefined();
  });

  /**
   * @testdoc @screenshot-authを解析できる
   * @purpose 認証要件の解析
   */
  it("should parse @screenshot-auth annotation", () => {
    const contentRequired = `
/**
 * @screen ProtectedPage
 * @screenshot
 * @screenshot-auth required
 */
export default function Page() {}
`;
    const resultRequired = parseScreenshotAnnotations(contentRequired, defaultFilePath);
    expect(resultRequired!.auth).toBe("required");

    const contentNone = `
/**
 * @screen PublicPage
 * @screenshot
 * @screenshot-auth none
 */
export default function Page() {}
`;
    const resultNone = parseScreenshotAnnotations(contentNone, defaultFilePath);
    expect(resultNone!.auth).toBe("none");

    const contentOptional = `
/**
 * @screen OptionalAuthPage
 * @screenshot
 * @screenshot-auth optional
 */
export default function Page() {}
`;
    const resultOptional = parseScreenshotAnnotations(contentOptional, defaultFilePath);
    expect(resultOptional!.auth).toBe("optional");
  });

  /**
   * @testdoc @screenshot-waitForを解析できる
   * @purpose 待機条件の解析
   */
  it("should parse @screenshot-waitFor annotation", () => {
    const content = `
/**
 * @screen TestPage
 * @screenshot
 * @screenshot-waitFor networkidle
 */
export default function Page() {}
`;
    const result = parseScreenshotAnnotations(content, defaultFilePath);
    expect(result!.waitFor).toBe("networkidle");
  });

  /**
   * @testdoc @screenshot-delayを解析できる
   * @purpose 遅延時間の解析
   */
  it("should parse @screenshot-delay annotation", () => {
    const content = `
/**
 * @screen TestPage
 * @screenshot
 * @screenshot-delay 500
 */
export default function Page() {}
`;
    const result = parseScreenshotAnnotations(content, defaultFilePath);
    expect(result!.delay).toBe(500);
  });

  /**
   * @testdoc 無効な@screenshot-delayは無視する
   * @purpose 不正な遅延指定のハンドリング
   */
  it("should ignore invalid delay format", () => {
    const content = `
/**
 * @screen TestPage
 * @screenshot
 * @screenshot-delay not-a-number
 */
export default function Page() {}
`;
    const result = parseScreenshotAnnotations(content, defaultFilePath);
    expect(result!.delay).toBeUndefined();
  });

  /**
   * @testdoc 全てのアノテーションを組み合わせて解析できる
   * @purpose 複合アノテーションの解析
   */
  it("should parse all annotations together", () => {
    const content = `
/**
 * Organization Dashboard Page
 *
 * Displays organization information and projects.
 *
 * @screen OrganizationDashboard
 * @feature OrganizationManagement
 * @route /[locale]/[orgSlug]
 * @screenshot
 * @screenshot-viewport 1440x900
 * @screenshot-auth required
 * @screenshot-waitFor domcontentloaded
 * @screenshot-delay 1000
 */
export default function OrganizationDashboardPage() {}
`;
    const result = parseScreenshotAnnotations(content, defaultFilePath);
    expect(result).toEqual({
      name: "OrganizationDashboard",
      filePath: defaultFilePath,
      enabled: true,
      viewport: { width: 1440, height: 900 },
      auth: "required",
      waitFor: "domcontentloaded",
      delay: 1000,
      description: "Organization Dashboard Page\n\nDisplays organization information and projects.",
      route: "/[locale]/[orgSlug]",
    });
  });

  /**
   * @testdoc @routeアノテーションを解析できる
   * @purpose 明示的なルート指定の解析
   */
  it("should extract @route annotation", () => {
    const content = `
/**
 * @screen TestPage
 * @screenshot
 * @route /ja/test
 */
export default function Page() {}
`;
    const result = parseScreenshotAnnotations(content, defaultFilePath);
    expect(result!.route).toBe("/ja/test");
  });

  /**
   * @testdoc @screenがない場合はファイル名からスクリーン名を推論する
   * @purpose スクリーン名のフォールバック
   */
  it("should infer screen name from file path if @screen is missing", () => {
    const content = `
/**
 * Dashboard Page
 * @screenshot
 */
export default function Page() {}
`;
    const result = parseScreenshotAnnotations(
      content,
      "apps/web/app/[locale]/dashboard/page.tsx"
    );
    expect(result).not.toBeNull();
    expect(result!.name).toBe("DashboardScreen");
  });

  /**
   * @testdoc 複数のJSDocブロックがある場合、@screenshotを含むものを検出する
   * @purpose 複数コメントブロックの処理
   */
  it("should find @screenshot in multiple JSDoc blocks", () => {
    const content = `
/**
 * Some utility function
 */
function helper() {}

/**
 * Main Page
 * @screen MainPage
 * @screenshot
 */
export default function Page() {}
`;
    const result = parseScreenshotAnnotations(content, defaultFilePath);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("MainPage");
  });

  /**
   * @testdoc 説明文を正しく抽出できる
   * @purpose JSDocの説明部分の抽出
   */
  it("should extract description correctly", () => {
    const content = `
/**
 * This is the first line.
 * This is the second line.
 *
 * @screen TestPage
 * @screenshot
 */
export default function Page() {}
`;
    const result = parseScreenshotAnnotations(content, defaultFilePath);
    expect(result!.description).toBe("This is the first line.\nThis is the second line.");
  });
});

describe("scanFilesForScreenshots", () => {
  /**
   * @testdoc 複数のファイル内容からスクリーンショット対象を収集できる
   * @purpose バッチ処理のテスト
   */
  it("should collect screenshots from multiple files", () => {
    const files: Array<{ content: string; path: string }> = [
      {
        path: "apps/web/app/[locale]/page.tsx",
        content: `
/**
 * @screen DashboardScreen
 * @screenshot
 */
export default function Page() {}
`,
      },
      {
        path: "apps/web/app/[locale]/settings/page.tsx",
        content: `
/**
 * @screen SettingsScreen
 * @screenshot
 * @screenshot-auth required
 */
export default function Page() {}
`,
      },
      {
        path: "apps/web/app/[locale]/about/page.tsx",
        content: `
/**
 * About page without screenshot annotation
 * @screen AboutScreen
 */
export default function Page() {}
`,
      },
    ];

    const results = scanFilesForScreenshots(files);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("DashboardScreen");
    expect(results[1].name).toBe("SettingsScreen");
    expect(results[1].auth).toBe("required");
  });

  /**
   * @testdoc 空の配列を処理できる
   * @purpose 空入力のハンドリング
   */
  it("should handle empty file list", () => {
    const results = scanFilesForScreenshots([]);
    expect(results).toHaveLength(0);
  });
});
