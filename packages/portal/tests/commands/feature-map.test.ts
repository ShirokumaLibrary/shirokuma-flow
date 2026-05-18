import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Feature Map Command Tests
 *
 * Tests for the feature map generation functionality.
 * Parses TypeScript files for custom JSDoc tags and generates a hierarchical feature map.
 */

import { parseFeatureMapTags } from "../../src/parsers/feature-map-tags.js";
import { buildFeatureMap } from "../../src/analyzers/feature-map-builder.js";
import type {
  FeatureMapItem,
  FeatureMap,
  ScreenItem,
  ComponentItem,
  ActionItem,
  TableItem,
} from "../../src/commands/feature-map-types.js";

describe("Feature Map Command", () => {
  describe("parseFeatureMapTags", () => {
    /**
     * @testdoc @screen タグを解析できる
     */
    it("should parse @screen tag", () => {
      const content = `
/**
 * @screen Dashboard
 * @route /dashboard
 * @feature UserManagement
 */
export default function DashboardPage() {
  return <div>Dashboard</div>;
}
`;
      const result = parseFeatureMapTags(content, "app/dashboard/page.tsx");

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("screen");
      expect(result[0].name).toBe("Dashboard");
      expect(result[0].route).toBe("/dashboard");
      expect(result[0].feature).toBe("UserManagement");
    });

    /**
     * @testdoc @component タグを解析できる
     */
    it("should parse @component tag", () => {
      const content = `
/**
 * @component UserForm
 * @usedInScreen Dashboard
 * @usedActions createUser, updateUser
 * @feature UserManagement
 */
export function UserForm() {
  return <form>...</form>;
}
`;
      const result = parseFeatureMapTags(content, "components/user-form.tsx");

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("component");
      expect(result[0].name).toBe("UserForm");
      expect(result[0].usedInScreens).toContain("Dashboard");
      expect(result[0].usedActions).toContain("createUser");
      expect(result[0].usedActions).toContain("updateUser");
    });

    /**
     * @testdoc @serverAction タグを解析できる
     */
    it("should parse @serverAction tag", () => {
      const content = `
/**
 * @serverAction
 * @usedInScreen Dashboard
 * @usedInComponent UserForm
 * @dbTables users, accounts
 * @feature UserManagement
 */
export async function createUser(data: FormData) {
  "use server";
  // ...
}
`;
      const result = parseFeatureMapTags(content, "lib/actions/user.ts");

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("action");
      expect(result[0].name).toBe("createUser");
      expect(result[0].usedInScreens).toContain("Dashboard");
      expect(result[0].usedInComponents).toContain("UserForm");
      expect(result[0].dbTables).toContain("users");
      expect(result[0].dbTables).toContain("accounts");
    });

    /**
     * @testdoc @dbTable タグを解析できる
     */
    it("should parse @dbTable tag", () => {
      const content = `
/**
 * @dbTable users
 * @feature UserManagement
 * ユーザー情報を管理するテーブル
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
});
`;
      const result = parseFeatureMapTags(content, "packages/database/src/schema/users.ts");

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("table");
      expect(result[0].name).toBe("users");
      expect(result[0].feature).toBe("UserManagement");
    });

    /**
     * @testdoc @usedComponents タグを解析できる
     */
    it("should parse @usedComponents tag", () => {
      const content = `
/**
 * @screen UserList
 * @route /users
 * @usedComponents UserCard, UserFilter, Pagination
 * @feature UserManagement
 */
export default function UserListPage() {
  return <div>User List</div>;
}
`;
      const result = parseFeatureMapTags(content, "app/users/page.tsx");

      expect(result).toHaveLength(1);
      expect(result[0].usedComponents).toContain("UserCard");
      expect(result[0].usedComponents).toContain("UserFilter");
      expect(result[0].usedComponents).toContain("Pagination");
    });

    /**
     * @testdoc 複数のJSDocブロックを解析できる
     */
    it("should parse multiple JSDoc blocks in a file", () => {
      const content = `
/**
 * @serverAction
 * @feature UserManagement
 */
export async function createUser() {}

/**
 * @serverAction
 * @feature UserManagement
 */
export async function deleteUser() {}
`;
      const result = parseFeatureMapTags(content, "lib/actions/user.ts");

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("createUser");
      expect(result[1].name).toBe("deleteUser");
    });

    /**
     * @testdoc featureタグがない場合はuncategorizedとして扱う
     */
    it("should treat items without @feature as uncategorized", () => {
      const content = `
/**
 * @screen Settings
 * @route /settings
 */
export default function SettingsPage() {
  return <div>Settings</div>;
}
`;
      const result = parseFeatureMapTags(content, "app/settings/page.tsx");

      expect(result).toHaveLength(1);
      expect(result[0].feature).toBeUndefined();
    });

    /**
     * @testdoc JSDocブロックから説明文を正しく抽出できる
     */
    it("should extract description from JSDoc", () => {
      const content = `
/**
 * ユーザーダッシュボード画面
 * メインの管理画面を表示する
 * @screen Dashboard
 * @route /dashboard
 * @feature UserManagement
 */
export default function DashboardPage() {
  return <div>Dashboard</div>;
}
`;
      const result = parseFeatureMapTags(content, "app/dashboard/page.tsx");

      expect(result).toHaveLength(1);
      expect(result[0].description).toContain("ユーザーダッシュボード画面");
    });
  });

  describe("buildFeatureMap", () => {
    /**
     * @testdoc 空の入力で空のFeatureMapを返す
     */
    it("should return empty feature map for empty input", () => {
      const result = buildFeatureMap([]);

      expect(Object.keys(result.features)).toHaveLength(0);
      expect(result.uncategorized.screens).toHaveLength(0);
      expect(result.uncategorized.components).toHaveLength(0);
      expect(result.uncategorized.actions).toHaveLength(0);
      expect(result.uncategorized.tables).toHaveLength(0);
    });

    /**
     * @testdoc featureごとにアイテムをグループ化できる
     */
    it("should group items by feature", () => {
      const items: FeatureMapItem[] = [
        {
          type: "screen",
          name: "Dashboard",
          path: "app/dashboard/page.tsx",
          feature: "UserManagement",
          route: "/dashboard",
          usedComponents: [],
          usedActions: [],
        },
        {
          type: "component",
          name: "UserForm",
          path: "components/user-form.tsx",
          feature: "UserManagement",
          usedInScreens: ["Dashboard"],
          usedActions: [],
        },
        {
          type: "screen",
          name: "Posts",
          path: "app/posts/page.tsx",
          feature: "ContentManagement",
          route: "/posts",
          usedComponents: [],
          usedActions: [],
        },
      ];

      const result = buildFeatureMap(items);

      expect(Object.keys(result.features)).toContain("UserManagement");
      expect(Object.keys(result.features)).toContain("ContentManagement");
      expect(result.features["UserManagement"].screens).toHaveLength(1);
      expect(result.features["UserManagement"].components).toHaveLength(1);
      expect(result.features["ContentManagement"].screens).toHaveLength(1);
    });

    /**
     * @testdoc featureがないアイテムをuncategorizedに分類する
     */
    it("should categorize items without feature as uncategorized", () => {
      const items: FeatureMapItem[] = [
        {
          type: "screen",
          name: "Settings",
          path: "app/settings/page.tsx",
          route: "/settings",
          usedComponents: [],
          usedActions: [],
        },
        {
          type: "component",
          name: "Header",
          path: "components/header.tsx",
          usedInScreens: [],
          usedActions: [],
        },
      ];

      const result = buildFeatureMap(items);

      expect(result.uncategorized.screens).toHaveLength(1);
      expect(result.uncategorized.components).toHaveLength(1);
      expect(result.uncategorized.screens[0].name).toBe("Settings");
      expect(result.uncategorized.components[0].name).toBe("Header");
    });

    /**
     * @testdoc 4層(screen, component, action, table)を正しく分類する
     */
    it("should correctly categorize all 4 layers", () => {
      const items: FeatureMapItem[] = [
        {
          type: "screen",
          name: "Dashboard",
          path: "app/dashboard/page.tsx",
          feature: "Test",
          route: "/dashboard",
          usedComponents: ["UserForm"],
          usedActions: ["createUser"],
        },
        {
          type: "component",
          name: "UserForm",
          path: "components/user-form.tsx",
          feature: "Test",
          usedInScreens: ["Dashboard"],
          usedActions: ["createUser"],
        },
        {
          type: "action",
          name: "createUser",
          path: "lib/actions/user.ts",
          feature: "Test",
          usedInScreens: ["Dashboard"],
          usedInComponents: ["UserForm"],
          dbTables: ["users"],
        },
        {
          type: "table",
          name: "users",
          path: "packages/database/src/schema/users.ts",
          feature: "Test",
          usedInActions: ["createUser"],
        },
      ];

      const result = buildFeatureMap(items);

      expect(result.features["Test"].screens).toHaveLength(1);
      expect(result.features["Test"].components).toHaveLength(1);
      expect(result.features["Test"].actions).toHaveLength(1);
      expect(result.features["Test"].tables).toHaveLength(1);
    });

    /**
     * @testdoc レイヤー間のリレーションを構築できる
     */
    it("should build relationships between layers", () => {
      const items: FeatureMapItem[] = [
        {
          type: "screen",
          name: "Dashboard",
          path: "app/dashboard/page.tsx",
          feature: "Test",
          route: "/dashboard",
          usedComponents: ["UserForm"],
          usedActions: ["createUser"],
        },
        {
          type: "action",
          name: "createUser",
          path: "lib/actions/user.ts",
          feature: "Test",
          usedInScreens: ["Dashboard"],
          usedInComponents: ["UserForm"],
          dbTables: ["users"],
        },
      ];

      const result = buildFeatureMap(items);
      const screen = result.features["Test"].screens[0];
      const action = result.features["Test"].actions[0];

      expect(screen.usedActions).toContain("createUser");
      expect(action.usedInScreens).toContain("Dashboard");
    });
  });

  describe("FeatureMap Interface", () => {
    /**
     * @testdoc ScreenItemの構造が正しい
     */
    it("should have correct ScreenItem structure", () => {
      const screen: ScreenItem = {
        name: "Dashboard",
        path: "app/dashboard/page.tsx",
        route: "/dashboard",
        description: "Main dashboard",
        usedComponents: ["UserCard"],
        usedActions: ["loadUsers"],
      };

      expect(screen.name).toBe("Dashboard");
      expect(screen.route).toBe("/dashboard");
      expect(screen.usedComponents).toContain("UserCard");
    });

    /**
     * @testdoc ComponentItemの構造が正しい
     */
    it("should have correct ComponentItem structure", () => {
      const component: ComponentItem = {
        name: "UserForm",
        path: "components/user-form.tsx",
        description: "User form component",
        usedInScreens: ["Dashboard"],
        usedInComponents: [],
        usedActions: ["createUser"],
      };

      expect(component.name).toBe("UserForm");
      expect(component.usedInScreens).toContain("Dashboard");
    });

    /**
     * @testdoc ActionItemの構造が正しい
     */
    it("should have correct ActionItem structure", () => {
      const action: ActionItem = {
        name: "createUser",
        path: "lib/actions/user.ts",
        description: "Creates a new user",
        usedInScreens: ["Dashboard"],
        usedInComponents: ["UserForm"],
        dbTables: ["users"],
      };

      expect(action.name).toBe("createUser");
      expect(action.dbTables).toContain("users");
    });

    /**
     * @testdoc TableItemの構造が正しい
     */
    it("should have correct TableItem structure", () => {
      const table: TableItem = {
        name: "users",
        path: "packages/database/src/schema/users.ts",
        description: "Users table",
        usedInActions: ["createUser", "deleteUser"],
      };

      expect(table.name).toBe("users");
      expect(table.usedInActions).toContain("createUser");
    });

    /**
     * @testdoc FeatureMapの全体構造が正しい
     */
    it("should have correct FeatureMap structure", () => {
      const featureMap: FeatureMap = {
        features: {
          UserManagement: {
            screens: [],
            components: [],
            actions: [],
            modules: [],
            tables: [],
          },
        },
        uncategorized: {
          screens: [],
          components: [],
          actions: [],
          modules: [],
          tables: [],
        },
        moduleDescriptions: {},
        moduleTypes: {},
        moduleUtilities: {},
        generatedAt: new Date().toISOString(),
      };

      expect(featureMap.features).toBeDefined();
      expect(featureMap.uncategorized).toBeDefined();
      expect(featureMap.generatedAt).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    /**
     * @testdoc 空のファイルを処理できる
     */
    it("should handle empty files", () => {
      const result = parseFeatureMapTags("", "empty.ts");
      expect(result).toHaveLength(0);
    });

    /**
     * @testdoc JSDocコメントがないファイルを処理できる
     */
    it("should handle files without JSDoc comments", () => {
      const content = `
export function helper() {
  return "hello";
}
`;
      const result = parseFeatureMapTags(content, "helper.ts");
      expect(result).toHaveLength(0);
    });

    /**
     * @testdoc 不正なJSDocコメントを無視する
     */
    it("should ignore invalid JSDoc comments", () => {
      const content = `
/* Not a JSDoc comment
 * @screen Invalid
 */
export function test() {}

/**
 * @screen Valid
 * @feature Test
 */
export function ValidScreen() {}
`;
      const result = parseFeatureMapTags(content, "test.tsx");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Valid");
    });

    /**
     * @testdoc カンマ区切りのリストを正しく解析する
     */
    it("should correctly parse comma-separated lists", () => {
      const content = `
/**
 * @screen Test
 * @usedComponents  CompA,CompB , CompC  ,  CompD
 * @feature Test
 */
export function TestScreen() {}
`;
      const result = parseFeatureMapTags(content, "test.tsx");

      expect(result[0].usedComponents).toHaveLength(4);
      expect(result[0].usedComponents).toEqual(["CompA", "CompB", "CompC", "CompD"]);
    });

    /**
     * @testdoc 日本語の説明文を正しく抽出できる
     */
    it("should correctly extract Japanese descriptions", () => {
      const content = `
/**
 * ユーザー管理画面
 * 管理者がユーザーを追加・編集・削除できる
 * @screen UserAdmin
 * @feature Admin
 */
export function UserAdminScreen() {}
`;
      const result = parseFeatureMapTags(content, "admin.tsx");

      expect(result[0].description).toContain("ユーザー管理画面");
      expect(result[0].description).toContain("管理者がユーザーを追加・編集・削除できる");
    });
  });
});
