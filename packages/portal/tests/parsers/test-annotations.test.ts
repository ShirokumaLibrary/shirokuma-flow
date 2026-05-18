import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Test Annotations Parser Tests
 *
 * Tests for extracting test cases, JSDoc comments, BDD annotations,
 * and describe-level documentation from test files.
 */

import {
  extractTestCases,
  extractTestDocComment,
  extractFileDocComment,
  extractDescribeDocComment,
  parseTestCategory,
  countBraces,
} from "../../src/parsers/test-annotations.js";

describe("test-annotations", () => {
  describe("countBraces", () => {
    /**
     * @testdoc 単一の開き波括弧を正しくカウントする
     */
    it("should count single opening brace", () => {
      expect(countBraces("{")).toBe(1);
    });

    /**
     * @testdoc 対になった波括弧のバランスを正しく計算する
     */
    it("should count balanced braces", () => {
      expect(countBraces("{ }")).toBe(0);
    });

    /**
     * @testdoc ネストされた波括弧の深さを正しくカウントする
     */
    it("should count nested braces", () => {
      expect(countBraces("{ { } }")).toBe(0);
      expect(countBraces("{ {")).toBe(2);
    });

    /**
     * @testdoc 文字列リテラル内の波括弧を無視する
     */
    it("should ignore braces inside strings", () => {
      expect(countBraces('const x = "{ }"')).toBe(0);
      expect(countBraces("const x = '{ }'")).toBe(0);
      expect(countBraces("const x = `{ }`")).toBe(0);
    });

    /**
     * @testdoc 空行に対してゼロを返す
     */
    it("should return 0 for empty line", () => {
      expect(countBraces("")).toBe(0);
    });

    /**
     * @testdoc エスケープされた文字を含む文字列を正しく処理する
     */
    it("should handle escaped characters", () => {
      expect(countBraces('const x = "\\"{\\""')).toBe(0);
    });
  });

  describe("parseTestCategory", () => {
    /**
     * @testdoc 正常系カテゴリのバリエーションを正しく解析する
     */
    it("should parse happy-path variants", () => {
      expect(parseTestCategory("happy-path")).toBe("happy-path");
      expect(parseTestCategory("success")).toBe("happy-path");
      expect(parseTestCategory("normal")).toBe("happy-path");
      expect(parseTestCategory("正常系")).toBe("happy-path");
    });

    /**
     * @testdoc 認証カテゴリのバリエーションを正しく解析する
     */
    it("should parse auth variants", () => {
      expect(parseTestCategory("auth")).toBe("auth");
      expect(parseTestCategory("authentication")).toBe("auth");
      expect(parseTestCategory("authorization")).toBe("auth");
      expect(parseTestCategory("認証")).toBe("auth");
      expect(parseTestCategory("認可")).toBe("auth");
    });

    /**
     * @testdoc エラーハンドリングカテゴリのバリエーションを正しく解析する
     */
    it("should parse error-handling variants", () => {
      expect(parseTestCategory("error")).toBe("error-handling");
      expect(parseTestCategory("error-handling")).toBe("error-handling");
      expect(parseTestCategory("エラー")).toBe("error-handling");
    });

    /**
     * @testdoc バリデーションカテゴリのバリエーションを正しく解析する
     */
    it("should parse validation variants", () => {
      expect(parseTestCategory("validation")).toBe("validation");
      expect(parseTestCategory("バリデーション")).toBe("validation");
      expect(parseTestCategory("検証")).toBe("validation");
    });

    /**
     * @testdoc エッジケースカテゴリのバリエーションを正しく解析する
     */
    it("should parse edge-case variants", () => {
      expect(parseTestCategory("edge")).toBe("edge-case");
      expect(parseTestCategory("boundary")).toBe("edge-case");
      expect(parseTestCategory("edge-case")).toBe("edge-case");
      expect(parseTestCategory("エッジケース")).toBe("edge-case");
      expect(parseTestCategory("境界値")).toBe("edge-case");
    });

    /**
     * @testdoc 未知のカテゴリに対してotherを返す
     */
    it("should return 'other' for unknown categories", () => {
      expect(parseTestCategory("unknown")).toBe("other");
      expect(parseTestCategory("random")).toBe("other");
    });

    /**
     * @testdoc カテゴリの大文字小文字を区別しない
     */
    it("should be case insensitive", () => {
      expect(parseTestCategory("AUTH")).toBe("auth");
      expect(parseTestCategory("Validation")).toBe("validation");
    });
  });

  describe("extractTestDocComment", () => {
    /**
     * @testdoc JSDocから@testdocタグの値を抽出する
     */
    it("should extract @testdoc from JSDoc", () => {
      const lines = [
        "/**",
        " * @testdoc ユーザーを作成する",
        " */",
        'it("should create user", () => {});',
      ];
      const result = extractTestDocComment(lines, 3);
      expect(result).not.toBeNull();
      expect(result!.testdoc).toBe("ユーザーを作成する");
    });

    /**
     * @testdoc 複数のタグ（purpose, precondition, expected）を同時に抽出する
     */
    it("should extract multiple tags", () => {
      const lines = [
        "/**",
        " * @testdoc テスト説明",
        " * @purpose テスト目的",
        " * @precondition 前提条件",
        " * @expected 期待結果",
        " */",
        'it("test", () => {});',
      ];
      const result = extractTestDocComment(lines, 6);
      expect(result).not.toBeNull();
      expect(result!.testdoc).toBe("テスト説明");
      expect(result!.purpose).toBe("テスト目的");
      expect(result!.precondition).toBe("前提条件");
      expect(result!.expected).toBe("期待結果");
    });

    /**
     * @testdoc BDDアノテーション（given/when/then/and）を抽出する
     */
    it("should extract BDD annotations", () => {
      const lines = [
        "/**",
        " * @given ユーザーが存在する",
        " * @when ログインする",
        " * @then ダッシュボードが表示される",
        " * @and メッセージが表示される",
        " */",
        'it("login flow", () => {});',
      ];
      const result = extractTestDocComment(lines, 6);
      expect(result).not.toBeNull();
      expect(result!.bdd).toBeDefined();
      expect(result!.bdd!.given).toBe("ユーザーが存在する");
      expect(result!.bdd!.when).toBe("ログインする");
      expect(result!.bdd!.then).toBe("ダッシュボードが表示される");
      expect(result!.bdd!.and).toEqual(["メッセージが表示される"]);
    });

    /**
     * @testdoc @testCategoryタグからカテゴリを抽出する
     */
    it("should extract @testCategory", () => {
      const lines = [
        "/**",
        " * @testCategory auth",
        " */",
        'it("test", () => {});',
      ];
      const result = extractTestDocComment(lines, 3);
      expect(result).not.toBeNull();
      expect(result!.category).toBe("auth");
    });

    /**
     * @testdoc @appタグからアプリ名を抽出する
     */
    it("should extract @app tag", () => {
      const lines = [
        "/**",
        " * @testdoc テスト",
        " * @app admin",
        " */",
        'it("test", () => {});',
      ];
      const result = extractTestDocComment(lines, 4);
      expect(result).not.toBeNull();
      expect(result!.app).toBe("admin");
    });

    /**
     * @testdoc @skip-reasonタグからスキップ理由を抽出する
     */
    it("should extract @skip-reason tag", () => {
      const lines = [
        "/**",
        " * @skip-reason CI環境で不安定",
        " */",
        'it.skip("test", () => {});',
      ];
      const result = extractTestDocComment(lines, 3);
      expect(result).not.toBeNull();
      expect(result!.skipReason).toBe("CI環境で不安定");
    });

    /**
     * @testdoc JSDocが存在しない場合にnullを返す
     */
    it("should return null when no JSDoc present", () => {
      const lines = [
        'const x = 1;',
        'it("test", () => {});',
      ];
      const result = extractTestDocComment(lines, 1);
      expect(result).toBeNull();
    });

    /**
     * @testdoc 関連タグのないJSDocに対してnullを返す
     */
    it("should return null for JSDoc without relevant tags", () => {
      const lines = [
        "/**",
        " * Just a description",
        " */",
        'it("test", () => {});',
      ];
      const result = extractTestDocComment(lines, 3);
      expect(result).toBeNull();
    });
  });

  describe("extractFileDocComment", () => {
    /**
     * @testdoc ファイルヘッダーから@testFileDocと関連タグを抽出する
     */
    it("should extract @testFileDoc from file header", () => {
      const content = `/**
 * @testFileDoc Server Actions テスト
 * @module actions
 * @coverage lib/actions
 */

describe("test", () => {});`;
      const result = extractFileDocComment(content);
      expect(result).not.toBeNull();
      expect(result!.description).toBe("Server Actions テスト");
      expect(result!.module).toBe("actions");
      expect(result!.coverage).toBe("lib/actions");
    });

    /**
     * @testdoc ファイルヘッダーから@appタグを抽出する
     */
    it("should extract @app from file header", () => {
      const content = `/**
 * @testFileDoc テスト
 * @app admin
 */`;
      const result = extractFileDocComment(content);
      expect(result).not.toBeNull();
      expect(result!.app).toBe("admin");
    });

    /**
     * @testdoc ファイルドキュメントがない場合にnullを返す
     */
    it("should return null when no file doc present", () => {
      const content = `import { something } from "somewhere";
describe("test", () => {});`;
      const result = extractFileDocComment(content);
      expect(result).toBeNull();
    });

    /**
     * @testdoc testFileDocタグのないJSDocに対してnullを返す
     */
    it("should return null for JSDoc without testFileDoc tags", () => {
      const content = `/**
 * Just a description without tags
 */
describe("test", () => {});`;
      const result = extractFileDocComment(content);
      expect(result).toBeNull();
    });
  });

  describe("extractDescribeDocComment", () => {
    /**
     * @testdoc describeブロックから@testGroupDocと関連タグを抽出する
     */
    it("should extract @testGroupDoc from describe", () => {
      const lines = [
        "/**",
        " * @testGroupDoc ユーザー管理テスト",
        " * @purpose CRUD操作の検証",
        " */",
        'describe("UserManagement", () => {',
      ];
      const result = extractDescribeDocComment(lines, 4);
      expect(result).not.toBeNull();
      expect(result!.testdoc).toBe("ユーザー管理テスト");
      expect(result!.purpose).toBe("CRUD操作の検証");
    });

    /**
     * @testdoc @priorityタグから優先度を抽出する
     */
    it("should extract @priority", () => {
      const lines = [
        "/**",
        " * @testGroupDoc テスト",
        " * @priority high",
        " */",
        'describe("test", () => {',
      ];
      const result = extractDescribeDocComment(lines, 4);
      expect(result).not.toBeNull();
      expect(result!.priority).toBe("high");
    });

    /**
     * @testdoc ドキュメントがない場合にnullを返す
     */
    it("should return null when no doc present", () => {
      const lines = [
        'const x = 1;',
        'describe("test", () => {',
      ];
      const result = extractDescribeDocComment(lines, 1);
      expect(result).toBeNull();
    });
  });

  describe("extractTestCases", () => {
    /**
     * @testdoc 単純なテストケースをdescribeとit名で抽出する
     */
    it("should extract simple test cases", () => {
      const content = `
describe("UserService", () => {
  /** @testdoc ユーザーを作成してDBに保存する */
  it("should create user", () => {
    expect(true).toBe(true);
  });

  /** @testdoc ユーザーをDBから削除して結果を返す */
  it("should delete user", () => {
    expect(true).toBe(true);
  });
});`;
      const cases = extractTestCases(content, "test.ts", "jest");
      expect(cases).toHaveLength(2);
      expect(cases[0].describe).toBe("UserService");
      expect(cases[0].it).toBe("should create user");
      expect(cases[1].it).toBe("should delete user");
    });

    /**
     * @testdoc ネストされたdescribeブロックのパスを結合して抽出する
     */
    it("should handle nested describes", () => {
      const content = `
describe("outer", () => {
  describe("inner", () => {
    /** @testdoc ネストされた内部テストの動作を検証する */
    it("test", () => {});
  });
});`;
      const cases = extractTestCases(content, "test.ts", "jest");
      expect(cases).toHaveLength(1);
      expect(cases[0].describe).toBe("outer > inner");
    });

    /**
     * @testdoc テストケースからJSDocの@testdocアノテーションを抽出する
     */
    it("should extract JSDoc annotations from test cases", () => {
      const content = `
describe("test", () => {
  /**
   * @testdoc ユーザーを新規作成する
   */
  it("should create user", () => {});
});`;
      const cases = extractTestCases(content, "test.ts", "jest");
      expect(cases).toHaveLength(1);
      expect(cases[0].description).toBe("ユーザーを新規作成する");
    });

    /**
     * @testdoc スキップされたテストを検出してフラグを設定する
     */
    it("should detect skipped tests", () => {
      const content = `
describe("test", () => {
  /**
   * @testdoc スキップ対象のテストケースを検証する
   * @skip-reason テストデータとして使用
   */
  it.skip("skipped test", () => {});
  /** @testdoc 通常実行のテストケースを検証する */
  it("normal test", () => {});
});`;
      const cases = extractTestCases(content, "test.ts", "jest");
      expect(cases).toHaveLength(2);
      expect(cases[0].skipped).toBe(true);
      expect(cases[1].skipped).toBeUndefined();
    });

    /**
     * @testdoc Playwrightのtest.describe構文を正しく処理する
     */
    it("should handle test.describe syntax", () => {
      const content = `
test.describe("E2E test", () => {
  /** @testdoc ページの読み込みが正常に完了することを検証する */
  test("should load page", async ({ page }) => {});
});`;
      const cases = extractTestCases(content, "test.spec.ts", "playwright");
      expect(cases).toHaveLength(1);
      expect(cases[0].describe).toBe("E2E test");
      expect(cases[0].framework).toBe("playwright");
    });

    /**
     * @testdoc テストケースの行番号を正確に記録する
     */
    it("should capture correct line numbers", () => {
      const content = `describe("test", () => {
  /** @testdoc 最初のテストケースの行番号を検証する */
  it("first", () => {});
  /** @testdoc 2番目のテストケースの行番号を検証する */
  it("second", () => {});
});`;
      const cases = extractTestCases(content, "test.ts", "jest");
      expect(cases[0].line).toBe(3);
      expect(cases[1].line).toBe(5);
    });

    /**
     * @testdoc describeブロック外のテストをファイル名ベースで分類する
     */
    it("should handle tests outside describe blocks", () => {
      const content = `it("standalone test", () => {});`;
      const cases = extractTestCases(content, "standalone.test.ts", "jest");
      expect(cases).toHaveLength(1);
      // Falls back to filename-based describe
      expect(cases[0].describe).toBe("standalone");
    });
  });
});
