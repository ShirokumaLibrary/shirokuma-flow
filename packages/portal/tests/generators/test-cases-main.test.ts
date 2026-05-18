import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * test-cases-main ジェネレーターテスト
 *
 * Markdown 生成、サイドバー付き HTML 生成、サマリーカード生成をテストする。
 *
 * @testdoc テストケースメインページ生成の回帰テスト
 */

import type {
  TestCase,
  TestSummary,
  FileStats,
} from "../../src/commands/test-cases-types.js";

import {
  generateMarkdown,
  generateHtml,
  buildSummaryCard,
} from "../../src/generators/test-cases-main.js";

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
    totalFiles: 2,
    totalTests: 10,
    jestFiles: 1,
    jestTests: 7,
    playwrightFiles: 1,
    playwrightTests: 3,
    fileStats: [
      createFileStats({ file: "__tests__/example.test.ts", tests: 7 }),
      createFileStats({ file: "e2e/login.spec.ts", framework: "playwright", tests: 3 }),
    ],
    ...overrides,
  };
}

// =============================================================================
// generateMarkdown
// =============================================================================

describe("generateMarkdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * @testdoc Markdown のタイトルとサマリーテーブルを生成する
   */
  it("should generate title and summary table", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    const result = generateMarkdown(testCases, summary, "/project");

    expect(result).toContain("# テストケース一覧");
    expect(result).toContain("## サマリー");
    expect(result).toContain("| 総テストファイル数 | 2 |");
    expect(result).toContain("| 総テストケース数 | 10 |");
    expect(result).toContain("| Jest ファイル数 | 1 |");
    expect(result).toContain("| Playwright テスト数 | 3 |");
  });

  /**
   * @testdoc フレームワーク別にテストをグループ化する
   */
  it("should group tests by framework", () => {
    const testCases = [
      createTestCase({ framework: "jest", describe: "JestTest", it: "jest test" }),
      createTestCase({ framework: "playwright", file: "e2e/login.spec.ts", describe: "E2E", it: "playwright test" }),
    ];
    const summary = createSummary();
    const result = generateMarkdown(testCases, summary, "/project");

    expect(result).toContain("## Jest テスト");
    expect(result).toContain("## Playwright テスト");
  });

  /**
   * @testdoc 日本語説明（description）がある場合に表示する
   */
  it("should display description when available", () => {
    const testCases = [createTestCase({ it: "should work", description: "正常に動作すること" })];
    const summary = createSummary();
    const result = generateMarkdown(testCases, summary, "/project");

    expect(result).toContain("正常に動作すること");
    expect(result).toContain("EN: should work");
  });

  /**
   * @testdoc BDD アノテーション付きテストケースに [BDD] バッジを表示する
   */
  it("should show BDD badge for BDD-annotated tests", () => {
    const testCases = [createTestCase({
      bdd: { given: "前提条件", when: "操作", then: "結果" },
    })];
    const summary = createSummary();
    const result = generateMarkdown(testCases, summary, "/project");

    expect(result).toContain("[BDD]");
    expect(result).toContain("**Given**: 前提条件");
    expect(result).toContain("**When**: 操作");
    expect(result).toContain("**Then**: 結果");
  });

  /**
   * @testdoc ファイル別統計テーブルを含む
   */
  it("should include file statistics table", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    const result = generateMarkdown(testCases, summary, "/project");

    expect(result).toContain("## ファイル別統計");
    expect(result).toContain("| ファイル | フレームワーク | describe数 | テスト数 |");
  });

  /**
   * @testdoc 生成日時が ja-JP ロケールで含まれる
   */
  it("should include generation date in ja-JP locale", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    const result = generateMarkdown(testCases, summary, "/project");

    expect(result).toContain("生成日時:");
  });

  /**
   * @testdoc purpose と expected がある場合にそれぞれの行を出力する
   */
  it("should include purpose and expected when available", () => {
    const testCases = [createTestCase({
      purpose: "テスト目的",
      expected: "期待される結果",
    })];
    const summary = createSummary();
    const result = generateMarkdown(testCases, summary, "/project");

    expect(result).toContain("目的: テスト目的");
    expect(result).toContain("期待: 期待される結果");
  });
});

// =============================================================================
// generateHtml
// =============================================================================

describe("generateHtml", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * @testdoc [test-cases-main] 完全な HTML ドキュメントを生成する
   */
  it("should generate a complete HTML document", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    const result = generateHtml(testCases, summary, "TestProject");

    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("<html");
    expect(result).toContain("</html>");
  });

  /**
   * @testdoc [test-cases-main] タイトルにプロジェクト名を含む
   */
  it("should include project name in title", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    const result = generateHtml(testCases, summary, "MyApp");

    expect(result).toContain("テストケース一覧 - MyApp");
  });

  /**
   * @testdoc サイドバーとメインコンテンツを含む
   */
  it("should include sidebar and main content", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    const result = generateHtml(testCases, summary, "TestProject");

    expect(result).toContain("sidebar");
    expect(result).toContain("main-container");
    expect(result).toContain("テストケース一覧");
  });

  /**
   * @testdoc 検索入力フィールドを含む
   */
  it("should include search input field", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    const result = generateHtml(testCases, summary, "TestProject");

    expect(result).toContain("searchInput");
    expect(result).toContain("テストを検索...");
  });

  /**
   * @testdoc カテゴリ別にテストをグループ化して表示する
   */
  it("should group tests by category in content", () => {
    const testCases = [
      createTestCase({ file: "__tests__/lib/actions/create.test.ts", describe: "create" }),
      createTestCase({ file: "__tests__/components/Button.test.tsx", describe: "Button" }),
    ];
    const summary = createSummary({
      fileStats: [
        createFileStats({ file: "__tests__/lib/actions/create.test.ts" }),
        createFileStats({ file: "__tests__/components/Button.test.tsx" }),
      ],
    });
    const result = generateHtml(testCases, summary, "TestProject");

    expect(result).toContain("Server Actions");
    expect(result).toContain("Components");
  });

  /**
   * @testdoc [test-cases-main] ポータルに戻るリンクを含む
   */
  it("should include back to portal link", () => {
    const testCases = [createTestCase()];
    const summary = createSummary();
    const result = generateHtml(testCases, summary, "TestProject");

    expect(result).toContain("ポータルに戻る");
    expect(result).toContain("index.html");
  });
});

// =============================================================================
// buildSummaryCard
// =============================================================================

describe("buildSummaryCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * @testdoc サマリーカードにファイル数とテスト数を表示する
   */
  it("should display file count and test count", () => {
    const summary = createSummary({ totalFiles: 5, totalTests: 42 });
    const result = buildSummaryCard(summary);

    expect(result).toContain("5");
    expect(result).toContain("42");
    expect(result).toContain("ファイル数");
    expect(result).toContain("テスト数");
  });

  /**
   * @testdoc Jest と Playwright のテスト数を個別に表示する
   */
  it("should display Jest and Playwright test counts separately", () => {
    const summary = createSummary({ jestTests: 30, playwrightTests: 12 });
    const result = buildSummaryCard(summary);

    expect(result).toContain("30");
    expect(result).toContain("12");
    expect(result).toContain("Jest");
    expect(result).toContain("Playwright");
  });

  /**
   * @testdoc summary-card クラスを持つ div を返す
   */
  it("should return div with summary-card class", () => {
    const summary = createSummary();
    const result = buildSummaryCard(summary);

    expect(result).toContain('class="summary-card"');
    expect(result).toContain('class="summary-grid"');
  });

  /**
   * @testdoc サマリーカードに生成日時のタイムスタンプを含む
   */
  it("should include generation timestamp", () => {
    const summary = createSummary();
    const result = buildSummaryCard(summary);

    expect(result).toContain("生成日時:");
  });
});
