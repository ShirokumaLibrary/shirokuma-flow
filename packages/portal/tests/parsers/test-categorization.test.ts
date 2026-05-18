import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Test Categorization Tests
 *
 * Tests for inferring test categories from test names and file paths,
 * computing category statistics, and creating test summaries.
 */

import {
  inferCategoryFromTestName,
  computeCategoryStats,
  inferModuleFromPath,
  getTestCategory,
  createSummary,
} from "../../src/parsers/test-categorization.js";
import type { TestCase, FileStats } from "../../src/commands/test-cases-types.js";

describe("test-categorization", () => {
  describe("inferCategoryFromTestName", () => {
    /**
     * @testdoc 認証関連キーワードからauthカテゴリを検出する
     */
    it("should detect auth-related tests", () => {
      expect(inferCategoryFromTestName("should authenticate user")).toBe("auth");
      expect(inferCategoryFromTestName("should redirect on login")).toBe("auth");
      expect(inferCategoryFromTestName("should handle logout")).toBe("auth");
      expect(inferCategoryFromTestName("unauthorized access")).toBe("auth");
      expect(inferCategoryFromTestName("forbidden when no permission")).toBe("auth");
    });

    /**
     * @testdoc 日本語の認証キーワードからauthカテゴリを検出する
     */
    it("should detect Japanese auth keywords", () => {
      expect(inferCategoryFromTestName("test", "認証が必要")).toBe("auth");
      expect(inferCategoryFromTestName("test", "ログインする")).toBe("auth");
      expect(inferCategoryFromTestName("test", "未認証の場合")).toBe("auth");
      expect(inferCategoryFromTestName("test", "権限がない")).toBe("auth");
    });

    /**
     * @testdoc エラー関連キーワードからerror-handlingカテゴリを検出する
     */
    it("should detect error-related tests", () => {
      expect(inferCategoryFromTestName("should throw error")).toBe("error-handling");
      expect(inferCategoryFromTestName("should fail gracefully")).toBe("error-handling");
      expect(inferCategoryFromTestName("should reject invalid input")).toBe("error-handling");
    });

    /**
     * @testdoc 日本語のエラーキーワードからerror-handlingカテゴリを検出する
     */
    it("should detect Japanese error keywords", () => {
      expect(inferCategoryFromTestName("test", "エラーが発生")).toBe("error-handling");
      expect(inferCategoryFromTestName("test", "失敗する")).toBe("error-handling");
    });

    /**
     * @testdoc バリデーション関連キーワードからvalidationカテゴリを検出する
     */
    it("should detect validation-related tests", () => {
      expect(inferCategoryFromTestName("should validate email")).toBe("validation");
      expect(inferCategoryFromTestName("should flag invalid format")).toBe("validation");
      expect(inferCategoryFromTestName("should require name field")).toBe("validation");
      expect(inferCategoryFromTestName("should handle missing data")).toBe("validation");
      expect(inferCategoryFromTestName("should flag empty input")).toBe("validation");
    });

    /**
     * @testdoc エッジケース関連キーワードからedge-caseカテゴリを検出する
     */
    it("should detect edge-case tests", () => {
      expect(inferCategoryFromTestName("edge case: large list")).toBe("edge-case");
      expect(inferCategoryFromTestName("boundary value: max length")).toBe("edge-case");
      expect(inferCategoryFromTestName("should handle limit")).toBe("edge-case");
      expect(inferCategoryFromTestName("should handle overflow")).toBe("edge-case");
    });

    /**
     * @testdoc CRUD操作キーワードからhappy-pathカテゴリを検出する
     */
    it("should detect happy-path tests", () => {
      expect(inferCategoryFromTestName("should create user")).toBe("happy-path");
      expect(inferCategoryFromTestName("should update profile")).toBe("happy-path");
      expect(inferCategoryFromTestName("should delete post")).toBe("happy-path");
      expect(inferCategoryFromTestName("should get users")).toBe("happy-path");
      expect(inferCategoryFromTestName("should list items")).toBe("happy-path");
    });

    /**
     * @testdoc 日本語のCRUD操作キーワードからhappy-pathカテゴリを検出する
     */
    it("should detect Japanese happy-path keywords", () => {
      expect(inferCategoryFromTestName("test", "作成できる")).toBe("happy-path");
      expect(inferCategoryFromTestName("test", "更新する")).toBe("happy-path");
      expect(inferCategoryFromTestName("test", "削除する")).toBe("happy-path");
      expect(inferCategoryFromTestName("test", "一覧取得")).toBe("happy-path");
      expect(inferCategoryFromTestName("test", "表示する")).toBe("happy-path");
    });

    /**
     * @testdoc 認識できないパターンに対してotherカテゴリを返す
     */
    it("should return 'other' for unrecognized patterns", () => {
      expect(inferCategoryFromTestName("renders correctly")).toBe("other");
      expect(inferCategoryFromTestName("snapshot test")).toBe("other");
    });
  });

  describe("computeCategoryStats", () => {
    /**
     * @testdoc テストケースからカテゴリ別統計を算出する
     */
    it("should compute category statistics", () => {
      const cases: TestCase[] = [
        { file: "test.ts", describe: "test", it: "should create", line: 1, framework: "jest" },
        { file: "test.ts", describe: "test", it: "should handle error", line: 2, framework: "jest" },
        { file: "test.ts", describe: "test", it: "auth check", line: 3, framework: "jest", category: "auth" },
      ];
      const stats = computeCategoryStats(cases);
      expect(stats["happy-path"]).toBe(1);
      expect(stats["error-handling"]).toBe(1);
      expect(stats.auth).toBe(1);
    });

    /**
     * @testdoc 空配列に対して全カテゴリのカウントをゼロで返す
     */
    it("should return zero stats for empty array", () => {
      const stats = computeCategoryStats([]);
      expect(stats["happy-path"]).toBe(0);
      expect(stats.auth).toBe(0);
      expect(stats["error-handling"]).toBe(0);
      expect(stats.validation).toBe(0);
      expect(stats["edge-case"]).toBe(0);
      expect(stats.integration).toBe(0);
      expect(stats.other).toBe(0);
    });

    /**
     * @testdoc 明示的に指定されたカテゴリが推論より優先される
     */
    it("should use explicit category over inferred", () => {
      const cases: TestCase[] = [
        { file: "test.ts", describe: "test", it: "should create", line: 1, framework: "jest", category: "integration" },
      ];
      const stats = computeCategoryStats(cases);
      expect(stats.integration).toBe(1);
      expect(stats["happy-path"]).toBe(0);
    });
  });

  describe("inferModuleFromPath", () => {
    /**
     * @testdoc actionsパスからactionモジュールを推論する
     */
    it("should infer action module from actions path", () => {
      const result = inferModuleFromPath("apps/web/__tests__/lib/actions/members.test.ts", "jest");
      expect(result.type).toBe("action");
      expect(result.name).toBe("members");
      expect(result.detailPath).toBe("details/actions/members.html");
    });

    /**
     * @testdoc componentsパスからcomponentモジュールを推論する
     */
    it("should infer component module from components path", () => {
      const result = inferModuleFromPath("apps/web/__tests__/components/UserForm.test.tsx", "jest");
      expect(result.type).toBe("component");
      expect(result.name).toBe("UserForm");
      expect(result.detailPath).toBe("details/components/UserForm.html");
    });

    /**
     * @testdoc Playwrightテストからscreenモジュールを推論する
     */
    it("should infer screen module for playwright tests", () => {
      const result = inferModuleFromPath("tests/e2e/dashboard.spec.ts", "playwright");
      expect(result.type).toBe("screen");
      expect(result.name).toBe("dashboard");
      expect(result.detailPath).toBe("details/screens/dashboard.html");
    });

    /**
     * @testdoc e2eディレクトリ配下のJestテストもscreen型と判定する
     */
    it("should detect e2e path for jest framework too", () => {
      const result = inferModuleFromPath("tests/e2e/login.spec.ts", "jest");
      expect(result.type).toBe("screen");
    });

    /**
     * @testdoc 認識できないパスに対してunknownモジュールを返す
     */
    it("should return unknown for unrecognized paths", () => {
      const result = inferModuleFromPath("src/utils/helpers.test.ts", "jest");
      expect(result.type).toBe("unknown");
      expect(result.name).toBe("helpers");
      expect(result.detailPath).toBe("");
    });

    /**
     * @testdoc テストファイルの拡張子をモジュール名から除去する
     */
    it("should strip test file extensions from name", () => {
      expect(inferModuleFromPath("test/actions/create.test.ts", "jest").name).toBe("create");
      expect(inferModuleFromPath("test/e2e/login.spec.tsx", "playwright").name).toBe("login");
    });
  });

  describe("getTestCategory", () => {
    /**
     * @testdoc モジュール型をテストカテゴリ名にマッピングする
     */
    it("should map module types to categories", () => {
      expect(getTestCategory({ type: "action", name: "x", detailPath: "" })).toBe("Server Actions");
      expect(getTestCategory({ type: "component", name: "x", detailPath: "" })).toBe("Components");
      expect(getTestCategory({ type: "screen", name: "x", detailPath: "" })).toBe("E2E");
      expect(getTestCategory({ type: "unknown", name: "x", detailPath: "" })).toBe("Other");
    });
  });

  describe("createSummary", () => {
    /**
     * @testdoc ファイル統計とテストケースからサマリーを正しく作成する
     */
    it("should create correct summary", () => {
      const fileStats: FileStats[] = [
        { file: "a.test.ts", framework: "jest", describes: 2, tests: 5 },
        { file: "b.test.ts", framework: "jest", describes: 1, tests: 3 },
        { file: "c.spec.ts", framework: "playwright", describes: 1, tests: 4 },
      ];
      const testCases: TestCase[] = new Array(12).fill(null).map((_, i) => ({
        file: `test${i}.ts`,
        describe: "test",
        it: `test ${i}`,
        line: i,
        framework: (i < 8 ? "jest" : "playwright") as "jest" | "playwright",
      }));

      const summary = createSummary(fileStats, testCases);
      expect(summary.totalFiles).toBe(3);
      expect(summary.totalTests).toBe(12);
      expect(summary.jestFiles).toBe(2);
      expect(summary.jestTests).toBe(8);
      expect(summary.playwrightFiles).toBe(1);
      expect(summary.playwrightTests).toBe(4);
      expect(summary.fileStats).toBe(fileStats);
    });

    /**
     * @testdoc 空の入力に対してゼロ値のサマリーを返す
     */
    it("should handle empty inputs", () => {
      const summary = createSummary([], []);
      expect(summary.totalFiles).toBe(0);
      expect(summary.totalTests).toBe(0);
      expect(summary.jestFiles).toBe(0);
      expect(summary.playwrightFiles).toBe(0);
    });
  });
});
