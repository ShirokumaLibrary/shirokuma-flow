import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Tests for details-context.ts
 *
 * Covers: createDetailsContext, extractModuleName, getElementFullKey,
 * getExistingMap, findElementLink, readSourceCode, extractFunctionCode
 */

import {
  createDetailsContext,
  extractModuleName,
  getElementFullKey,
  getExistingMap,
  findElementLink,
  extractFunctionCode,
} from "../../src/commands/details-context.js";
import type { DetailsContext } from "../../src/commands/details-types.js";

describe("details-context", () => {
  describe("createDetailsContext", () => {
    /**
     * @testdoc 空のDetailsContextを初期化し、全要素マップが空のMapインスタンスであることを確認する
     */
    it("should create an empty context", () => {
      const ctx = createDetailsContext();
      expect(ctx.allTestCases).toEqual([]);
      expect(ctx.detailsJsonItems).toEqual({});
      expect(ctx.existingElements.screens).toBeInstanceOf(Map);
      expect(ctx.existingElements.components).toBeInstanceOf(Map);
      expect(ctx.existingElements.actions).toBeInstanceOf(Map);
      expect(ctx.existingElements.modules).toBeInstanceOf(Map);
      expect(ctx.existingElements.tables).toBeInstanceOf(Map);
    });
  });

  describe("extractModuleName", () => {
    /**
     * @testdoc ルートグループディレクトリ（括弧付き）からモジュール名を抽出する
     */
    it("should extract module from route group directory", () => {
      expect(extractModuleName("apps/admin/app/[locale]/(entities)/page.tsx")).toBe("entities");
    });

    /**
     * @testdoc 動的ルートセグメント（[id]等）をスキップしてモジュール名を抽出する
     */
    it("should skip dynamic route segments", () => {
      expect(extractModuleName("apps/admin/app/[locale]/(dashboard)/[id]/page.tsx")).toBe("dashboard");
    });

    /**
     * @testdoc 除外ディレクトリ（app, lib等）を避けて意味のあるディレクトリ名を使用する
     */
    it("should use meaningful directory name, not excluded dirs", () => {
      expect(extractModuleName("apps/admin/components/projects/ProjectList.tsx")).toBe("projects");
    });

    /**
     * @testdoc 意味のあるディレクトリが見つからない場合はファイル名をフォールバックとして使用する
     */
    it("should fall back to filename when no meaningful dir found", () => {
      expect(extractModuleName("app/lib/utils.ts")).toBe("utils");
    });

    /**
     * @testdoc Windows形式のパス区切り（バックスラッシュ）を正しく処理する
     */
    it("should handle Windows-style paths", () => {
      expect(extractModuleName("apps\\admin\\components\\projects\\ProjectList.tsx")).toBe("projects");
    });

    /**
     * @testdoc 一般的な除外ディレクトリ（lib等）をスキップして上位の意味あるディレクトリを探す
     */
    it("should skip common excluded directories", () => {
      // "lib" is excluded, so it should go up to find a meaningful name
      expect(extractModuleName("src/lib/helpers.ts")).toBe("helpers");
    });

    /**
     * @testdoc ネストされたモジュールパスから正しいモジュール名を抽出する
     */
    it("should handle nested module paths", () => {
      expect(extractModuleName("apps/web/lib/actions/entities/create.ts")).toBe("entities");
    });
  });

  describe("getElementFullKey", () => {
    /**
     * @testdoc モジュール名と要素名から「module/name」形式のフルキーを生成する
     */
    it("should generate key with module/name format", () => {
      expect(getElementFullKey("entities", "DashboardPage")).toBe("entities/DashboardPage");
    });
  });

  describe("getExistingMap", () => {
    let ctx: DetailsContext;

    beforeEach(() => {
      ctx = createDetailsContext();
      ctx.existingElements.screens.set("dashboard/DashboardPage", "dashboard");
      ctx.existingElements.components.set("projects/ProjectList", "projects");
      ctx.existingElements.actions.set("entities/createEntity", "entities");
      ctx.existingElements.modules.set("auth/authHelper", "auth");
      ctx.existingElements.tables.set("schema/users", "schema");
    });

    /**
     * @testdoc linkTypeが「screen」の場合にscreensマップを返す
     */
    it("should return screens map for 'screen' linkType", () => {
      const map = getExistingMap(ctx, "screen");
      expect(map.has("dashboard/DashboardPage")).toBe(true);
    });

    /**
     * @testdoc linkTypeが「component」の場合にcomponentsマップを返す
     */
    it("should return components map for 'component' linkType", () => {
      const map = getExistingMap(ctx, "component");
      expect(map.has("projects/ProjectList")).toBe(true);
    });

    /**
     * @testdoc linkTypeが「action」の場合にactionsマップを返す
     */
    it("should return actions map for 'action' linkType", () => {
      const map = getExistingMap(ctx, "action");
      expect(map.has("entities/createEntity")).toBe(true);
    });

    /**
     * @testdoc linkTypeが「module」の場合にmodulesマップを返す
     */
    it("should return modules map for 'module' linkType", () => {
      const map = getExistingMap(ctx, "module");
      expect(map.has("auth/authHelper")).toBe(true);
    });

    /**
     * @testdoc linkTypeが「table」の場合にtablesマップを返す
     */
    it("should return tables map for 'table' linkType", () => {
      const map = getExistingMap(ctx, "table");
      expect(map.has("schema/users")).toBe(true);
    });

    /**
     * @testdoc 不明なlinkTypeの場合に空のMapを返す
     */
    it("should return empty map for unknown linkType", () => {
      const map = getExistingMap(ctx, "unknown");
      expect(map.size).toBe(0);
    });
  });

  describe("findElementLink", () => {
    let ctx: DetailsContext;

    beforeEach(() => {
      ctx = createDetailsContext();
      ctx.existingElements.screens.set("dashboard/DashboardPage", "dashboard");
      ctx.existingElements.components.set("projects/ProjectList", "projects");
      ctx.existingElements.components.set("shared/ProjectList", "shared");
    });

    /**
     * @testdoc 要素名でリンクを検索しモジュール情報を返す
     */
    it("should find element link by name", () => {
      const result = findElementLink(ctx, "screen", "DashboardPage");
      expect(result).toEqual({ module: "dashboard" });
    });

    /**
     * @testdoc 同名要素が複数モジュールに存在する場合は最初の一致を返す
     */
    it("should return first match when multiple modules have same element name", () => {
      const result = findElementLink(ctx, "component", "ProjectList");
      expect(result).not.toBeNull();
      expect(result!.module).toBeDefined();
    });

    /**
     * @testdoc 存在しない要素名を検索した場合にnullを返す
     */
    it("should return null for non-existing element", () => {
      const result = findElementLink(ctx, "screen", "NonExistentPage");
      expect(result).toBeNull();
    });

    /**
     * @testdoc 不明なlinkTypeで検索した場合にnullを返す
     */
    it("should return null for unknown linkType", () => {
      const result = findElementLink(ctx, "unknown", "DashboardPage");
      expect(result).toBeNull();
    });
  });

  describe("extractFunctionCode", () => {
    /**
     * @testdoc 名前付き関数をJSDocコメントごと抽出し他の関数を含めない
     */
    it("should extract a named function with JSDoc", () => {
      const source = `
import { something } from "somewhere";

/**
 * Dashboard page component
 * @screen DashboardPage
 */
export function DashboardPage() {
  return <div>Dashboard</div>;
}

export function OtherPage() {
  return <div>Other</div>;
}`;

      const result = extractFunctionCode(source, "DashboardPage");
      expect(result).toContain("Dashboard page component");
      expect(result).toContain("export function DashboardPage");
      expect(result).toContain("return <div>Dashboard</div>");
      expect(result).not.toContain("OtherPage");
    });

    /**
     * @testdoc constアロー関数の定義を正しく抽出する
     */
    it("should extract const arrow function", () => {
      const source = `
export const createEntity = async (data: FormData) => {
  const result = await db.insert(entities).values(data);
  return result;
};

export const deleteEntity = async (id: string) => {
  await db.delete(entities).where(eq(entities.id, id));
};`;

      const result = extractFunctionCode(source, "createEntity");
      expect(result).toContain("export const createEntity");
      expect(result).toContain("db.insert");
    });

    /**
     * @testdoc 対象関数が見つからない場合はソースコード全体を返す
     */
    it("should return full source when target not found", () => {
      const source = "const x = 1;";
      const result = extractFunctionCode(source, "NonExistent");
      expect(result).toBe(source);
    });

    /**
     * @testdoc async関数の定義を正しく抽出する
     */
    it("should handle async function", () => {
      const source = `
export async function fetchData(id: string) {
  const data = await fetch(\`/api/\${id}\`);
  return data.json();
}`;

      const result = extractFunctionCode(source, "fetchData");
      expect(result).toContain("export async function fetchData");
      expect(result).toContain("return data.json()");
    });

    /**
     * @testdoc ネストされた波括弧（map内のif文等）を正しく追跡し関数境界を判定する
     */
    it("should handle nested braces correctly", () => {
      const source = `
export function complexFn(items: Item[]) {
  const result = items.map((item) => {
    if (item.type === "a") {
      return { ...item, processed: true };
    }
    return item;
  });
  return result;
}

export function otherFn() { return 1; }`;

      const result = extractFunctionCode(source, "complexFn");
      expect(result).toContain("export function complexFn");
      expect(result).toContain("return result;");
      expect(result).not.toContain("otherFn");
    });
  });
});
