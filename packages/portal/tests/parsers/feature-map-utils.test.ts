import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Feature Map Utils Tests
 *
 * Tests for shared utility functions used by feature-map tag parsing
 * and type extraction modules.
 */

import {
  extractTags,
  extractDescription,
  parseCommaSeparatedList,
  extractModuleName,
} from "../../src/parsers/feature-map-utils.js";

describe("feature-map-utils", () => {
  describe("extractTags", () => {
    /**
     * @testdoc JSDocブロックから基本的なタグを抽出する
     */
    it("should extract basic tags", () => {
      const jsdoc = `/**
 * @screen Dashboard
 * @route /dashboard
 * @feature UserManagement
 */`;
      const tags = extractTags(jsdoc);

      expect(tags.screen).toBe("Dashboard");
      expect(tags.route).toBe("/dashboard");
      expect(tags.feature).toBe("UserManagement");
    });

    /**
     * @testdoc 値なしのマーカータグ（@serverAction）を空文字列で処理する
     */
    it("should handle marker tags like @serverAction", () => {
      const jsdoc = `/**
 * @serverAction
 * @feature Test
 */`;
      const tags = extractTags(jsdoc);

      expect(tags.serverAction).toBe("");
      expect(tags.feature).toBe("Test");
    });

    /**
     * @testdoc タグ値の前後の空白をトリムする
     */
    it("should trim tag values", () => {
      const jsdoc = `/**
 * @screen  Dashboard
 * @route  /dashboard
 */`;
      const tags = extractTags(jsdoc);

      expect(tags.screen).toBe("Dashboard");
      expect(tags.route).toBe("/dashboard");
    });

    /**
     * @testdoc カンマ区切りの値を単一文字列として保持する
     */
    it("should preserve comma-separated values as single string", () => {
      const jsdoc = `/**
 * @usedComponents CompA, CompB, CompC
 * @dbTables users, accounts
 */`;
      const tags = extractTags(jsdoc);

      expect(tags.usedComponents).toBe("CompA, CompB, CompC");
      expect(tags.dbTables).toBe("users, accounts");
    });

    /**
     * @testdoc タグのないJSDocに対して空オブジェクトを返す
     */
    it("should return empty object for JSDoc without tags", () => {
      const jsdoc = `/**
 * Just a description
 * with multiple lines
 */`;
      const tags = extractTags(jsdoc);

      expect(Object.keys(tags)).toHaveLength(0);
    });

    /**
     * @testdoc 閉じタグ直前のインラインタグを抽出する
     */
    it("should extract tags before closing */", () => {
      const jsdoc = `/** @screen Inline */`;
      const tags = extractTags(jsdoc);

      expect(tags.screen).toBe("Inline");
    });
  });

  describe("extractDescription", () => {
    /**
     * @testdoc 単一行の説明文を抽出する
     */
    it("should extract single-line description", () => {
      const jsdoc = `/**
 * Dashboard page component
 * @screen Dashboard
 */`;
      const desc = extractDescription(jsdoc);
      expect(desc).toBe("Dashboard page component");
    });

    /**
     * @testdoc 複数行の説明文を結合して抽出する
     */
    it("should extract multi-line description", () => {
      const jsdoc = `/**
 * Dashboard page component
 * Shows user statistics and recent activity
 * @screen Dashboard
 */`;
      const desc = extractDescription(jsdoc);
      expect(desc).toContain("Dashboard page component");
      expect(desc).toContain("Shows user statistics and recent activity");
    });

    /**
     * @testdoc タグのみで説明文がないJSDocに対してundefinedを返す
     */
    it("should return undefined when no description exists", () => {
      const jsdoc = `/**
 * @screen Dashboard
 * @route /dashboard
 */`;
      const desc = extractDescription(jsdoc);
      expect(desc).toBeUndefined();
    });

    /**
     * @testdoc 日本語の説明文を正しく抽出する
     */
    it("should extract Japanese description", () => {
      const jsdoc = `/**
 * ユーザー管理画面
 * @screen UserAdmin
 */`;
      const desc = extractDescription(jsdoc);
      expect(desc).toBe("ユーザー管理画面");
    });

    /**
     * @testdoc 説明文の相対インデントを保持する
     */
    it("should preserve content after JSDoc marker", () => {
      const jsdoc = `/**
 * Main description
 *   indented content
 * @tag value
 */`;
      const desc = extractDescription(jsdoc);
      expect(desc).toContain("Main description");
      expect(desc).toContain("  indented content");
    });
  });

  describe("parseCommaSeparatedList", () => {
    /**
     * @testdoc カンマ区切りの値を配列に分割する
     */
    it("should parse comma-separated values", () => {
      const result = parseCommaSeparatedList("CompA, CompB, CompC");
      expect(result).toEqual(["CompA", "CompB", "CompC"]);
    });

    /**
     * @testdoc undefined入力に対して空配列を返す
     */
    it("should return empty array for undefined", () => {
      const result = parseCommaSeparatedList(undefined);
      expect(result).toEqual([]);
    });

    /**
     * @testdoc 空文字列に対して空配列を返す
     */
    it("should return empty array for empty string", () => {
      const result = parseCommaSeparatedList("");
      expect(result).toEqual([]);
    });

    /**
     * @testdoc 値の前後の空白をトリムして返す
     */
    it("should trim whitespace from values", () => {
      const result = parseCommaSeparatedList("  CompA ,  CompB  , CompC  ");
      expect(result).toEqual(["CompA", "CompB", "CompC"]);
    });

    /**
     * @testdoc カンマなしの単一値を1要素の配列として返す
     */
    it("should handle single value", () => {
      const result = parseCommaSeparatedList("CompA");
      expect(result).toEqual(["CompA"]);
    });

    /**
     * @testdoc 末尾カンマや連続カンマによる空エントリを除外する
     */
    it("should filter out empty entries", () => {
      const result = parseCommaSeparatedList("CompA,,CompB,");
      expect(result).toEqual(["CompA", "CompB"]);
    });
  });

  describe("extractModuleName", () => {
    /**
     * @testdoc actionsディレクトリからモジュール名を抽出する
     */
    it("should extract module name from actions path", () => {
      const result = extractModuleName("apps/web/lib/actions/members.ts");
      expect(result).toBe("members");
    });

    /**
     * @testdoc componentsパスからサブディレクトリ名を抽出する
     */
    it("should extract module name from components path", () => {
      const result = extractModuleName("apps/web/components/ui/button.tsx");
      expect(result).toBe("ui");
    });

    /**
     * @testdoc ルートグループの括弧を除去してグループ名を抽出する
     */
    it("should extract route group name without parentheses", () => {
      const result = extractModuleName("apps/web/app/[locale]/(dashboard)/page.tsx");
      expect(result).toBe("dashboard");
    });

    /**
     * @testdoc 動的ルートセグメントをスキップして次のディレクトリを使用する
     */
    it("should skip dynamic route segments", () => {
      const result = extractModuleName("apps/web/app/[locale]/settings/page.tsx");
      expect(result).toBe("settings");
    });

    /**
     * @testdoc パッケージパスから除外対象外の最初のディレクトリを抽出する
     */
    it("should extract from package path", () => {
      const result = extractModuleName("packages/database/src/schema/users.ts");
      // "users" is the filename, "schema" is excluded, "src" is excluded, "database" is the first non-excluded dir
      expect(result).toBe("database");
    });

    /**
     * @testdoc 有効なディレクトリがない場合にファイル名にフォールバックする
     */
    it("should fallback to filename when no meaningful directory", () => {
      const result = extractModuleName("src/utils.ts");
      expect(result).toBe("utils");
    });

    /**
     * @testdoc lib, app, srcなどの共通ディレクトリ名をスキップする
     */
    it("should skip excluded directories like lib, app, src", () => {
      const result = extractModuleName("apps/web/lib/auth/session.ts");
      expect(result).toBe("auth");
    });

    /**
     * @testdoc バックスラッシュ区切りのWindowsパスを正しく処理する
     */
    it("should handle backslash paths", () => {
      const result = extractModuleName("apps\\web\\lib\\actions\\members.ts");
      expect(result).toBe("members");
    });
  });
});
