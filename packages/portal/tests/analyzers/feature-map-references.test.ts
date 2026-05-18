import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Feature Map References Tests
 *
 * Tests for reference merging, table reverse references,
 * and module reference building.
 */

import {
  mergeInferredReferences,
  mergeArrays,
  buildTableReverseReferences,
  buildModuleReferences,
} from "../../src/analyzers/feature-map-references.js";
import type { FeatureMapItem } from "../../src/commands/feature-map-types.js";
import type {
  ReferenceAnalysisResult,
  FileUsage,
} from "../../src/analyzers/reference-analyzer.js";

/**
 * Helper to create a minimal ReferenceAnalysisResult for testing
 */
function createEmptyReferenceResult(): ReferenceAnalysisResult {
  return {
    fileUsages: new Map<string, FileUsage>(),
    reverseRefs: {
      componentToFiles: new Map<string, string[]>(),
      actionToFiles: new Map<string, string[]>(),
      moduleToFiles: new Map<string, string[]>(),
      modulePathToFiles: new Map<string, string[]>(),
    },
  };
}

describe("feature-map-references", () => {
  describe("mergeArrays", () => {
    /**
     * @testdoc 2つの配列を重複排除してマージする
     */
    it("should merge arrays without duplicates", () => {
      const result = mergeArrays(["a", "b"], ["b", "c"]);
      expect(result).toEqual(["a", "b", "c"]);
    });

    /**
     * @testdoc 空配列同士のマージを正しく処理する
     */
    it("should handle empty arrays", () => {
      expect(mergeArrays([], [])).toEqual([]);
      expect(mergeArrays(["a"], [])).toEqual(["a"]);
      expect(mergeArrays([], ["b"])).toEqual(["b"]);
    });
  });

  describe("buildTableReverseReferences", () => {
    /**
     * @testdoc ActionのdbTablesからTableアイテムへの逆参照を構築する
     */
    it("should build reverse references from action dbTables to table items", () => {
      const items: FeatureMapItem[] = [
        {
          type: "action",
          name: "createUser",
          path: "lib/actions/user.ts",
          dbTables: ["users", "accounts"],
        },
        {
          type: "action",
          name: "deleteUser",
          path: "lib/actions/user.ts",
          dbTables: ["users"],
        },
        {
          type: "table",
          name: "users",
          path: "schema/users.ts",
          usedInActions: [],
        },
        {
          type: "table",
          name: "accounts",
          path: "schema/accounts.ts",
          usedInActions: [],
        },
      ];

      buildTableReverseReferences(items);

      const usersTable = items.find(i => i.type === "table" && i.name === "users");
      const accountsTable = items.find(i => i.type === "table" && i.name === "accounts");

      expect(usersTable?.usedInActions).toContain("createUser");
      expect(usersTable?.usedInActions).toContain("deleteUser");
      expect(accountsTable?.usedInActions).toContain("createUser");
      expect(accountsTable?.usedInActions).not.toContain("deleteUser");
    });

    /**
     * @testdoc 逆参照の重複を排除する（内部でSetを使用）
     */
    it("should deduplicate reverse references", () => {
      const items: FeatureMapItem[] = [
        {
          type: "action",
          name: "createUser",
          path: "lib/actions/user.ts",
          dbTables: ["users"],
        },
        {
          type: "table",
          name: "users",
          path: "schema/users.ts",
          usedInActions: [],
        },
      ];

      // Call twice to verify no duplicates are created
      buildTableReverseReferences(items);
      buildTableReverseReferences(items);

      const usersTable = items.find(i => i.type === "table" && i.name === "users");
      const createUserCount = usersTable?.usedInActions?.filter(a => a === "createUser").length;
      expect(createUserCount).toBe(1);
    });

    /**
     * @testdoc dbTablesを持たないActionはTableアイテムに影響しない
     */
    it("should handle actions without dbTables", () => {
      const items: FeatureMapItem[] = [
        {
          type: "action",
          name: "sendEmail",
          path: "lib/actions/email.ts",
          // no dbTables
        },
        {
          type: "table",
          name: "users",
          path: "schema/users.ts",
          usedInActions: [],
        },
      ];

      buildTableReverseReferences(items);

      const usersTable = items.find(i => i.type === "table" && i.name === "users");
      expect(usersTable?.usedInActions).toHaveLength(0);
    });

    /**
     * @testdoc 空のアイテム配列でもエラーを発生させない
     */
    it("should handle empty items array", () => {
      const items: FeatureMapItem[] = [];
      expect(() => buildTableReverseReferences(items)).not.toThrow();
    });

    /**
     * @testdoc テーブル名の大文字小文字を区別せずにマッチングする
     */
    it("should match table names case-insensitively", () => {
      const items: FeatureMapItem[] = [
        {
          type: "action",
          name: "createUser",
          path: "lib/actions/user.ts",
          dbTables: ["Users"],
        },
        {
          type: "table",
          name: "users",
          path: "schema/users.ts",
          usedInActions: [],
        },
      ];

      buildTableReverseReferences(items);

      const usersTable = items.find(i => i.type === "table" && i.name === "users");
      expect(usersTable?.usedInActions).toContain("createUser");
    });
  });

  describe("mergeInferredReferences", () => {
    /**
     * @testdoc ScreenのusedComponentsにfileUsagesからコンポーネント参照をマージする
     */
    it("should merge component references into screen items via fileUsages", () => {
      const items: FeatureMapItem[] = [
        {
          type: "screen",
          name: "Dashboard",
          path: "apps/web/app/dashboard/page.tsx",
          usedComponents: [],
          usedActions: [],
        },
      ];

      const result = createEmptyReferenceResult();
      result.fileUsages.set("apps/web/app/dashboard/page.tsx", {
        filePath: "apps/web/app/dashboard/page.tsx",
        usedComponents: ["UserCard", "ActivityFeed"],
        usedActions: [],
        usedModules: [],
        usedModulePaths: [],
      });

      mergeInferredReferences(items, result, "/project");

      expect(items[0].usedComponents).toContain("UserCard");
      expect(items[0].usedComponents).toContain("ActivityFeed");
    });

    /**
     * @testdoc ScreenのusedActionsにfileUsagesからアクション参照をマージする
     */
    it("should merge action references into screen items via fileUsages", () => {
      const items: FeatureMapItem[] = [
        {
          type: "screen",
          name: "Dashboard",
          path: "apps/web/app/dashboard/page.tsx",
          usedComponents: [],
          usedActions: [],
        },
      ];

      const result = createEmptyReferenceResult();
      result.fileUsages.set("apps/web/app/dashboard/page.tsx", {
        filePath: "apps/web/app/dashboard/page.tsx",
        usedComponents: [],
        usedActions: ["getProjects", "getActivities"],
        usedModules: [],
        usedModulePaths: [],
      });

      mergeInferredReferences(items, result, "/project");

      expect(items[0].usedActions).toContain("getProjects");
      expect(items[0].usedActions).toContain("getActivities");
    });

    /**
     * @testdoc ComponentのusedInScreensにreverseRefsから逆参照をマージする
     */
    it("should merge reverse component references from reverseRefs", () => {
      const items: FeatureMapItem[] = [
        {
          type: "screen",
          name: "Dashboard",
          path: "apps/web/app/dashboard/page.tsx",
          usedComponents: [],
          usedActions: [],
        },
        {
          type: "component",
          name: "UserCard",
          path: "apps/web/components/user-card.tsx",
          usedInScreens: [],
          usedInComponents: [],
          usedActions: [],
        },
      ];

      const result = createEmptyReferenceResult();
      result.reverseRefs.componentToFiles.set("UserCard", [
        "apps/web/app/dashboard/page.tsx",
      ]);

      mergeInferredReferences(items, result, "/project");

      expect(items[1].usedInScreens).toContain("Dashboard");
    });

    /**
     * @testdoc 既存の参照を保持しつつ重複なくマージする
     */
    it("should not duplicate existing references when merging", () => {
      const items: FeatureMapItem[] = [
        {
          type: "screen",
          name: "Dashboard",
          path: "apps/web/app/dashboard/page.tsx",
          usedComponents: ["UserCard"],
          usedActions: ["getProjects"],
        },
      ];

      const result = createEmptyReferenceResult();
      result.fileUsages.set("apps/web/app/dashboard/page.tsx", {
        filePath: "apps/web/app/dashboard/page.tsx",
        usedComponents: ["UserCard", "NewComponent"],
        usedActions: ["getProjects", "newAction"],
        usedModules: [],
        usedModulePaths: [],
      });

      mergeInferredReferences(items, result, "/project");

      const userCardCount = items[0].usedComponents!.filter(c => c === "UserCard").length;
      expect(userCardCount).toBe(1);
      expect(items[0].usedComponents).toContain("NewComponent");
      expect(items[0].usedActions).toContain("newAction");
    });

    /**
     * @testdoc 空の参照解析結果の場合はアイテムを変更しない
     */
    it("should not modify items when reference result is empty", () => {
      const items: FeatureMapItem[] = [
        {
          type: "screen",
          name: "Dashboard",
          path: "apps/web/app/dashboard/page.tsx",
          usedComponents: ["Original"],
          usedActions: [],
        },
      ];

      const result = createEmptyReferenceResult();
      mergeInferredReferences(items, result, "/project");

      expect(items[0].usedComponents).toEqual(["Original"]);
    });

    /**
     * @testdoc ActionのusedInScreensにreverseRefsから逆参照をマージする
     */
    it("should merge reverse action references from reverseRefs", () => {
      const items: FeatureMapItem[] = [
        {
          type: "screen",
          name: "Dashboard",
          path: "apps/web/app/dashboard/page.tsx",
          usedComponents: [],
          usedActions: [],
        },
        {
          type: "action",
          name: "createUser",
          path: "apps/web/lib/actions/user.ts",
          usedInScreens: [],
          usedInComponents: [],
          dbTables: [],
        },
      ];

      const result = createEmptyReferenceResult();
      result.reverseRefs.actionToFiles.set("createUser", [
        "apps/web/app/dashboard/page.tsx",
      ]);

      mergeInferredReferences(items, result, "/project");

      expect(items[1].usedInScreens).toContain("Dashboard");
    });
  });

  describe("buildModuleReferences", () => {
    /**
     * @testdoc fileUsagesからモジュール間の相互参照を構築する
     */
    it("should build module-to-module references from fileUsages", () => {
      const items: FeatureMapItem[] = [
        {
          type: "module",
          name: "auth-session",
          path: "apps/web/lib/auth/session.ts",
          category: "auth",
          usedModules: [],
          usedInModules: [],
        },
        {
          type: "module",
          name: "security-csrf",
          path: "apps/web/lib/security/csrf.ts",
          category: "security",
          usedModules: [],
          usedInModules: [],
        },
      ];

      const result = createEmptyReferenceResult();
      result.fileUsages.set("apps/web/lib/auth/session.ts", {
        filePath: "apps/web/lib/auth/session.ts",
        usedComponents: [],
        usedActions: [],
        usedModules: ["security"],
        usedModulePaths: ["apps/web/lib/security/csrf.ts"],
      });

      buildModuleReferences(items, result, "/project");

      const authModule = items.find(i => i.name === "auth-session");
      const securityModule = items.find(i => i.name === "security-csrf");

      // Auth module should reference security module
      expect(authModule?.usedModules).toContain("security-csrf");
      // Security module should have reverse reference to auth
      expect(securityModule?.usedInModules).toContain("auth-session");
    });

    /**
     * @testdoc 空のモジュールアイテム配列でもエラーを発生させない
     */
    it("should handle empty items gracefully", () => {
      const items: FeatureMapItem[] = [];
      const result = createEmptyReferenceResult();

      expect(() => buildModuleReferences(items, result, "/project")).not.toThrow();
    });

    /**
     * @testdoc モジュール以外のアイテムタイプには影響しない
     */
    it("should not affect non-module items", () => {
      const items: FeatureMapItem[] = [
        {
          type: "screen",
          name: "Dashboard",
          path: "apps/web/app/dashboard/page.tsx",
          usedComponents: [],
        },
      ];

      const result = createEmptyReferenceResult();
      buildModuleReferences(items, result, "/project");

      expect(items[0].usedModules).toBeUndefined();
    });
  });
});
