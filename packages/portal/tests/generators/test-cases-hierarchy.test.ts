import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * test-cases-hierarchy ジェネレーターテスト
 *
 * 3階層構造のテストケースページ生成（カテゴリ一覧、ファイル一覧、テスト詳細）をテストする。
 *
 * @testdoc テストケース階層ページ生成の回帰テスト
 */

import type {
  TestCase,
  TestSummary,
  FileStats,
} from "../../src/commands/test-cases-types.js";

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

const {
  generateCategoryListPage,
  generateHierarchicalPages,
} = await import("../../src/generators/test-cases-hierarchy.js");

afterEach(() => {
  vi.restoreAllMocks();
  mockWriteFile.mockReset();
  mockEnsureDir.mockReset();
});

// =============================================================================
// Helpers
// =============================================================================

function createTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    file: "__tests__/example.test.ts",
    describe: "Example",
    it: "should work",
    line: 10,
    framework: "jest",
    ...overrides,
  };
}

function createFileStats(overrides: Partial<FileStats> = {}): FileStats {
  return {
    file: "__tests__/example.test.ts",
    framework: "jest",
    describes: 1,
    tests: 3,
    ...overrides,
  };
}

function createSummary(overrides: Partial<TestSummary> = {}): TestSummary {
  return {
    totalFiles: 1,
    totalTests: 3,
    jestFiles: 1,
    jestTests: 3,
    playwrightFiles: 0,
    playwrightTests: 0,
    fileStats: [createFileStats()],
    ...overrides,
  };
}

// =============================================================================
// generateCategoryListPage
// =============================================================================

describe("generateCategoryListPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * @testdoc [test-cases-hierarchy] 完全な HTML ドキュメントを生成する
   */
  it("should generate a complete HTML document", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    const result = generateCategoryListPage(testCases, summary, "TestProject");

    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("<html");
    expect(result).toContain("</html>");
  });

  /**
   * @testdoc [test-cases-hierarchy] タイトルにプロジェクト名を含む
   */
  it("should include project name in title", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    const result = generateCategoryListPage(testCases, summary, "MyApp");

    expect(result).toContain("テストケース - MyApp");
  });

  /**
   * @testdoc テスト数とファイル数の統計を表示する
   */
  it("should display test and file statistics", () => {
    const testCases = [createTestCase()];
    const summary = createSummary({ totalTests: 42, totalFiles: 5 });
    const result = generateCategoryListPage(testCases, summary, "TestProject");

    expect(result).toContain("42 テスト");
    expect(result).toContain("5 ファイル");
  });

  /**
   * @testdoc カテゴリカードにリンクとアイコンを含む
   */
  it("should include category cards with links and icons", () => {
    const testCases = [
      createTestCase({ file: "__tests__/lib/actions/create.test.ts" }),
    ];
    const summary = createSummary({
      fileStats: [createFileStats({ file: "__tests__/lib/actions/create.test.ts" })],
    });
    const result = generateCategoryListPage(testCases, summary, "TestProject");

    expect(result).toContain("category-card");
    expect(result).toContain("test-cases/");
    expect(result).toContain(".html");
  });

  /**
   * @testdoc テストがないカテゴリのカードは生成しない
   */
  it("should not generate cards for empty categories", () => {
    const testCases = [createTestCase()];
    const summary = createSummary({
      fileStats: [createFileStats()],
    });
    const result = generateCategoryListPage(testCases, summary, "TestProject");

    // Other カテゴリのみ存在すべき（__tests__/example.test.ts は Other）
    expect(result).toContain("Other");
  });

  /**
   * @testdoc [test-cases-hierarchy] ポータルに戻るリンクを含む
   */
  it("should include back to portal link", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    const result = generateCategoryListPage(testCases, summary, "TestProject");

    expect(result).toContain("ポータルに戻る");
    expect(result).toContain("index.html");
  });

  /**
   * @testdoc カテゴリバッジにテストカテゴリ統計を表示する
   */
  it("should display category badges with test category stats", () => {
    const testCases = [createTestCase()];
    const summary = createSummary({
      fileStats: [createFileStats({
        categoryStats: {
          "happy-path": 3,
          "error-handling": 0,
          auth: 0,
          validation: 0,
          "edge-case": 0,
          integration: 0,
          other: 0,
        },
      })],
    });
    const result = generateCategoryListPage(testCases, summary, "TestProject");

    expect(result).toContain("test-category-badge");
    expect(result).toContain("✅");
  });
});

// =============================================================================
// generateHierarchicalPages
// =============================================================================

describe("generateHierarchicalPages", () => {
  /**
   * @testdoc カテゴリページと詳細ページの数を返す
   */
  it("should return counts of generated category and detail pages", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    const result = generateHierarchicalPages(testCases, summary, "TestProject", "/output");

    expect(result.categoryPages).toBeGreaterThanOrEqual(1);
    expect(result.detailPages).toBeGreaterThanOrEqual(1);
  });

  /**
   * @testdoc ensureDir でカテゴリディレクトリを作成する
   */
  it("should create category directories via ensureDir", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    generateHierarchicalPages(testCases, summary, "TestProject", "/output");

    expect(mockEnsureDir).toHaveBeenCalled();
  });

  /**
   * @testdoc writeFile でカテゴリ HTML とテスト詳細 HTML を書き込む
   */
  it("should write category HTML and test detail HTML files", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    generateHierarchicalPages(testCases, summary, "TestProject", "/output");

    // カテゴリページ + 詳細ページの書き込み
    expect(mockWriteFile.mock.calls.length).toBeGreaterThanOrEqual(2);

    // カテゴリページの書き込みを確認
    const categoryCall = mockWriteFile.mock.calls.find(
      ([path]) => typeof path === "string" && path.endsWith(".html") && !path.includes("/other/")
    );
    expect(categoryCall).toBeDefined();
  });

  /**
   * @testdoc 複数カテゴリのテストがある場合にそれぞれのページを生成する
   */
  it("should generate pages for multiple categories", () => {
    const testCases = [
      createTestCase({ file: "__tests__/lib/actions/create.test.ts", describe: "create" }),
      createTestCase({ file: "__tests__/components/Button.test.tsx", describe: "Button" }),
      createTestCase({ file: "e2e/login.spec.ts", framework: "playwright", describe: "Login" }),
    ];
    const summary = createSummary({
      totalFiles: 3,
      totalTests: 3,
      fileStats: [
        createFileStats({ file: "__tests__/lib/actions/create.test.ts" }),
        createFileStats({ file: "__tests__/components/Button.test.tsx" }),
        createFileStats({ file: "e2e/login.spec.ts", framework: "playwright" }),
      ],
    });

    const result = generateHierarchicalPages(testCases, summary, "TestProject", "/output");
    expect(result.categoryPages).toBeGreaterThanOrEqual(3);
    expect(result.detailPages).toBe(3);
  });

  /**
   * @testdoc 書き込まれた HTML にパンくずナビゲーションを含む
   */
  it("should include breadcrumb navigation in written HTML", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    generateHierarchicalPages(testCases, summary, "TestProject", "/output");

    // 詳細ページの HTML 内容を検査
    const detailCall = mockWriteFile.mock.calls.find(
      ([path]) => typeof path === "string" && path.includes("/other/")
    );
    expect(detailCall).toBeDefined();
    const [, content] = detailCall!;
    expect(content).toContain("breadcrumb");
    expect(content).toContain("テストケース");
  });

  /**
   * @testdoc 書き込まれた HTML にグローバルナビ要素を含む
   */
  it("should include global nav elements in written HTML", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    generateHierarchicalPages(testCases, summary, "TestProject", "/output");

    expect(mockWriteFile.mock.calls.length).toBeGreaterThan(0);
    const anyCall = mockWriteFile.mock.calls[0];
    const [, content] = anyCall;
    expect(content).toContain("global-nav");
  });

  /**
   * @testdoc テストケースが空のカテゴリのページは生成しない
   */
  it("should not generate pages for empty categories", () => {
    const testCases = [createTestCase()];
    const summary = createSummary({
      fileStats: [createFileStats()],
    });
    const result = generateHierarchicalPages(testCases, summary, "TestProject", "/output");

    // Other のみ1カテゴリ
    expect(result.categoryPages).toBe(1);
    expect(result.detailPages).toBe(1);
  });
});
