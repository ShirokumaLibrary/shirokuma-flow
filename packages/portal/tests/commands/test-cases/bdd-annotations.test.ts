import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * BDD Annotations Parser Tests
 *
 * @testdoc BDD アノテーション (@given/@when/@then/@and) のパース機能テスト
 */

import { extractTestDocComment } from "../../../src/parsers/test-annotations.js";

describe("BDD Annotations Parser", () => {
  /**
   * @testdoc Given-When-Then の基本パターンをパースできる
   * @given BDD アノテーションを含む JSDoc コメント
   * @when extractTestDocComment を実行
   * @then bdd オブジェクトに given/when/then が含まれる
   */
  it("should parse basic Given-When-Then pattern", () => {
    const lines = [
      "/**",
      " * @testdoc ユーザーがログインできる",
      " * @given ユーザーが存在する",
      " * @when 正しいパスワードでログインする",
      " * @then ダッシュボードにリダイレクトされる",
      " */",
      "it('should login user', async () => {",
    ];

    const result = extractTestDocComment(lines, 6);

    expect(result).not.toBeNull();
    expect(result?.testdoc).toBe("ユーザーがログインできる");
    expect(result?.bdd).toBeDefined();
    expect(result?.bdd?.given).toBe("ユーザーが存在する");
    expect(result?.bdd?.when).toBe("正しいパスワードでログインする");
    expect(result?.bdd?.then).toBe("ダッシュボードにリダイレクトされる");
  });

  /**
   * @testdoc @and タグを複数パースできる
   * @given 複数の @and タグを含む JSDoc コメント
   * @when extractTestDocComment を実行
   * @then bdd.and 配列に全ての追加条件が含まれる
   */
  it("should parse multiple @and tags", () => {
    const lines = [
      "/**",
      " * @testdoc 複数条件のテスト",
      " * @given 初期状態",
      " * @when アクションを実行",
      " * @then 結果1",
      " * @and 結果2",
      " * @and 結果3",
      " */",
      "it('should handle multiple conditions', () => {",
    ];

    const result = extractTestDocComment(lines, 8);

    expect(result).not.toBeNull();
    expect(result?.bdd?.and).toEqual(["結果2", "結果3"]);
  });

  /**
   * @testdoc 従来のタグと BDD タグを混在できる
   * @given @testdoc, @purpose, @given, @when, @then を含むコメント
   * @when extractTestDocComment を実行
   * @then 全てのタグが正しくパースされる
   */
  it("should parse mixed traditional and BDD annotations", () => {
    const lines = [
      "/**",
      " * @testdoc ユーザー作成テスト",
      " * @purpose ユーザー作成 API の正常系確認",
      " * @precondition 管理者権限がある",
      " * @expected ユーザーが DB に保存される",
      " * @given 有効なユーザーデータ",
      " * @when createUser を呼び出す",
      " * @then ユーザー ID が返される",
      " */",
      "it('should create user', async () => {",
    ];

    const result = extractTestDocComment(lines, 9);

    expect(result).not.toBeNull();
    // 従来のタグ
    expect(result?.testdoc).toBe("ユーザー作成テスト");
    expect(result?.purpose).toBe("ユーザー作成 API の正常系確認");
    expect(result?.precondition).toBe("管理者権限がある");
    expect(result?.expected).toBe("ユーザーが DB に保存される");
    // BDD タグ
    expect(result?.bdd?.given).toBe("有効なユーザーデータ");
    expect(result?.bdd?.when).toBe("createUser を呼び出す");
    expect(result?.bdd?.then).toBe("ユーザー ID が返される");
  });

  /**
   * @testdoc BDD タグがない場合は bdd プロパティが undefined
   * @given BDD タグを含まない JSDoc コメント
   * @when extractTestDocComment を実行
   * @then bdd プロパティが undefined
   */
  it("should return undefined bdd when no BDD tags present", () => {
    const lines = [
      "/**",
      " * @testdoc 通常のテスト",
      " * @purpose 目的説明",
      " */",
      "it('should do something', () => {",
    ];

    const result = extractTestDocComment(lines, 4);

    expect(result).not.toBeNull();
    expect(result?.testdoc).toBe("通常のテスト");
    expect(result?.bdd).toBeUndefined();
  });

  /**
   * @testdoc 部分的な BDD タグでも bdd オブジェクトが生成される
   * @given @given のみを含む JSDoc コメント
   * @when extractTestDocComment を実行
   * @then bdd.given が設定され、when/then は undefined
   */
  it("should handle partial BDD annotations", () => {
    const lines = [
      "/**",
      " * @testdoc 部分的なBDDテスト",
      " * @given 前提条件のみ",
      " */",
      "it('should handle partial BDD', () => {",
    ];

    const result = extractTestDocComment(lines, 4);

    expect(result).not.toBeNull();
    expect(result?.bdd).toBeDefined();
    expect(result?.bdd?.given).toBe("前提条件のみ");
    expect(result?.bdd?.when).toBeUndefined();
    expect(result?.bdd?.then).toBeUndefined();
  });
});
