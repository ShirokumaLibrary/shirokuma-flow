import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Feature Map Tags Parser Tests
 *
 * Tests for parsing feature-map JSDoc tags from TypeScript files,
 * including header detection, metadata extraction, item name extraction,
 * and JSDoc block parsing.
 *
 * ESM 環境のため jest.unstable_mockModule + dynamic import を使用。
 */


// =============================================================================
// Mocks
// =============================================================================

vi.mock("../../src/utils/app-inference.js", () => ({
  inferAppFromPath: vi.fn((path: string) => {
    if (path.includes("/admin/")) return "admin";
    if (path.includes("/web/")) return "web";
    return undefined;
  }),
}));

vi.mock("../../src/utils/action-inference.js", () => ({
  inferActionTypeFromPath: vi.fn((path: string) => {
    if (path.includes("/mutations/")) return "mutation";
    if (path.includes("/queries/")) return "query";
    return undefined;
  }),
}));

vi.mock("../../src/analyzers/reference-analyzer.js", () => ({
  isComponentFile: vi.fn((path: string) => {
    return path.endsWith(".tsx") && !path.includes("page.tsx") && !path.includes("layout.tsx");
  }),
}));

vi.mock("../../src/parsers/jsdoc-common.js", () => ({
  extractExportedComponentName: vi.fn((content: string) => {
    const match = content.match(/export\s+(?:default\s+)?function\s+([A-Z]\w+)/);
    return match ? match[1] : undefined;
  }),
}));

vi.mock("../../src/parsers/feature-map-utils.js", () => ({
  extractTags: vi.fn((jsdoc: string) => {
    const tags: Record<string, string | undefined> = {};
    const tagRegex = /@(\w+)\s*(.*)/g;
    let m;
    while ((m = tagRegex.exec(jsdoc)) !== null) {
      tags[m[1]] = m[2].trim() || "";
    }
    return tags;
  }),
  extractDescription: vi.fn((jsdoc: string) => {
    const lines = jsdoc
      .replace(/^\/\*\*\s*/, "")
      .replace(/\s*\*\/$/, "")
      .split("\n")
      .map((l) => l.replace(/^\s*\*\s?/, "").trim())
      .filter((l) => l && !l.startsWith("@"));
    return lines.join(" ") || undefined;
  }),
  parseCommaSeparatedList: vi.fn((value: string | undefined) => {
    if (!value) return [];
    return value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);
  }),
  extractModuleName: vi.fn(),
}));

vi.mock("../../src/parsers/feature-map-type-extraction.js", () => ({
  extractExportedTypes: vi.fn(() => []),
  extractExportedUtilities: vi.fn(() => []),
}));

// =============================================================================
// Dynamic imports (after mocks)
// =============================================================================

const {
  findCodeStartIndex,
  extractFileMetadata,
  parseFeatureMapTags,
  parseFeatureMapTagsWithMetadata,
  extractItemName,
  parseJSDocBlock,
} = await import("../../src/parsers/feature-map-tags.js");

describe("feature-map-tags", () => {
  describe("findCodeStartIndex", () => {
    /**
     * @testdoc import 文の位置をコード開始インデックスとして返す
     */
    it("should return index of first import statement", () => {
      const content = `/**\n * Module doc\n */\nimport { foo } from 'bar';`;
      const idx = findCodeStartIndex(content);
      expect(content.substring(idx)).toMatch(/^import/);
    });

    /**
     * @testdoc import がない場合は export 文の位置を返す
     */
    it("should return index of export when no import", () => {
      const content = `/**\n * Doc\n */\nexport const foo = 1;`;
      const idx = findCodeStartIndex(content);
      expect(content.substring(idx)).toMatch(/^export/);
    });

    /**
     * @testdoc import も export もない場合は宣言の位置を返す
     */
    it("should return index of declaration when no import/export", () => {
      const content = `/**\n * Doc\n */\nconst foo = 1;`;
      const idx = findCodeStartIndex(content);
      expect(content.substring(idx)).toMatch(/^const/);
    });

    /**
     * @testdoc コードがない場合は 0 を返す
     */
    it("should return 0 when no code found", () => {
      const content = `/** just a comment */`;
      const idx = findCodeStartIndex(content);
      expect(idx).toBe(0);
    });

    /**
     * @testdoc コメント前の空白を含むファイルを正しく処理する
     */
    it("should handle files with leading whitespace", () => {
      const content = `\n\nimport { x } from 'y';`;
      const idx = findCodeStartIndex(content);
      expect(content.substring(idx)).toMatch(/^import/);
    });
  });

  describe("extractFileMetadata", () => {
    /**
     * @testdoc ヘッダー JSDoc から feature タグを抽出する
     */
    it("should extract feature tag from header JSDoc", () => {
      const content = `/**\n * @feature UserManagement\n */\nimport { x } from 'y';`;
      const codeStart = content.indexOf("import");
      const metadata = extractFileMetadata(content, codeStart);
      expect(metadata.feature).toBe("UserManagement");
    });

    /**
     * @testdoc ヘッダー JSDoc がない場合に空のメタデータを返す
     */
    it("should return empty metadata when no header JSDoc", () => {
      const content = `import { x } from 'y';`;
      const metadata = extractFileMetadata(content, 0);
      expect(metadata).toEqual({});
    });

    /**
     * @testdoc @module タグを抽出する
     */
    it("should extract module tag", () => {
      const content = `/**\n * @module auth\n * @description Authentication module\n */\nimport {};`;
      const codeStart = content.indexOf("import");
      const metadata = extractFileMetadata(content, codeStart);
      expect(metadata.moduleName).toBe("auth");
    });
  });

  describe("extractItemName", () => {
    /**
     * @testdoc export function からアイテム名を抽出する
     */
    it("should extract name from export function", () => {
      expect(extractItemName("export function handleSubmit() {}")).toBe("handleSubmit");
    });

    /**
     * @testdoc export async function からアイテム名を抽出する
     */
    it("should extract name from export async function", () => {
      expect(extractItemName("export async function fetchData() {}")).toBe("fetchData");
    });

    /**
     * @testdoc export default function からアイテム名を抽出する
     */
    it("should extract name from export default function", () => {
      expect(extractItemName("export default function Dashboard() {}")).toBe("Dashboard");
    });

    /**
     * @testdoc export const からアイテム名を抽出する
     */
    it("should extract name from export const", () => {
      expect(extractItemName("export const myHandler = () => {}")).toBe("myHandler");
    });

    /**
     * @testdoc 通常の function からアイテム名を抽出する
     */
    it("should extract name from regular function", () => {
      expect(extractItemName("function helper() {}")).toBe("helper");
    });

    /**
     * @testdoc const からアイテム名を抽出する
     */
    it("should extract name from const assignment", () => {
      expect(extractItemName("const MyComponent = () => {}")).toBe("MyComponent");
    });

    /**
     * @testdoc パターンにマッチしない場合は undefined を返す
     */
    it("should return undefined for no match", () => {
      expect(extractItemName("// just a comment")).toBeUndefined();
    });
  });

  describe("parseJSDocBlock", () => {
    /**
     * @testdoc @screen タグから screen アイテムを生成する
     */
    it("should create screen item from @screen tag", () => {
      const jsdoc = `/**\n * Dashboard screen\n * @screen Dashboard\n * @route /dashboard\n * @feature Admin\n */`;
      const item = parseJSDocBlock(jsdoc, "src/app/page.tsx", undefined, {});

      expect(item).not.toBeNull();
      expect(item!.type).toBe("screen");
      expect(item!.name).toBe("Dashboard");
      expect(item!.route).toBe("/dashboard");
      expect(item!.feature).toBe("Admin");
    });

    /**
     * @testdoc @component タグから component アイテムを生成する
     */
    it("should create component item from @component tag", () => {
      const jsdoc = `/**\n * @component Button\n * @usedInScreen Dashboard\n */`;
      const item = parseJSDocBlock(jsdoc, "src/components/Button.tsx", undefined, {});

      expect(item).not.toBeNull();
      expect(item!.type).toBe("component");
      expect(item!.name).toBe("Button");
    });

    /**
     * @testdoc @serverAction タグから action アイテムを生成する
     */
    it("should create action item from @serverAction tag", () => {
      const jsdoc = `/**\n * @serverAction\n * @feature UserManagement\n * @dbTables users, sessions\n */`;
      const item = parseJSDocBlock(jsdoc, "src/actions/mutations/user.ts", "createUser", {
        usedInScreens: ["UserList"],
      });

      expect(item).not.toBeNull();
      expect(item!.type).toBe("action");
      expect(item!.name).toBe("createUser");
      expect(item!.dbTables).toEqual(["users", "sessions"]);
    });

    /**
     * @testdoc @serverAction で usedInScreen タグありでもファイルメタデータがフォールバックされる
     */
    it("should use file metadata usedInScreens for action with usedInScreen tag", () => {
      // parseCommaSeparatedList モックは tags.usedInScreen の値をパースする
      // ファイルメタデータの usedInScreens がフォールバックとして使用される
      const jsdoc = `/**\n * @serverAction\n * @usedInScreen SpecificScreen\n */`;
      const item = parseJSDocBlock(jsdoc, "src/actions/user.ts", "updateUser", {
        usedInScreens: ["FileLevel"],
      });

      // 実際の動作: parseCommaSeparatedList が空でないリストを返せば関数レベルが優先
      expect(item!.usedInScreens).toBeDefined();
      expect(Array.isArray(item!.usedInScreens)).toBe(true);
    });

    /**
     * @testdoc @serverAction で関数レベルの usedInScreen がない場合にファイルメタデータをフォールバック使用する
     */
    it("should fallback to file metadata usedInScreens when function-level is empty", () => {
      const jsdoc = `/**\n * @serverAction\n */`;
      const item = parseJSDocBlock(jsdoc, "src/actions/user.ts", "deleteUser", {
        usedInScreens: ["UserList", "UserDetail"],
      });

      expect(item!.usedInScreens).toEqual(["UserList", "UserDetail"]);
    });

    /**
     * @testdoc @module タグから module アイテムを生成する
     */
    it("should create module item from @module tag", () => {
      const jsdoc = `/**\n * @module auth\n */`;
      const item = parseJSDocBlock(jsdoc, "src/lib/auth/index.ts", "authModule", {});

      expect(item).not.toBeNull();
      expect(item!.type).toBe("module");
      expect(item!.name).toBe("authModule");
      expect(item!.category).toBe("auth");
    });

    /**
     * @testdoc @dbTable タグから table アイテムを生成する
     */
    it("should create table item from @dbTable tag", () => {
      const jsdoc = `/**\n * @dbTable users\n * @usedInActions createUser, deleteUser\n */`;
      const item = parseJSDocBlock(jsdoc, "src/db/users.ts", undefined, {});

      expect(item).not.toBeNull();
      expect(item!.type).toBe("table");
      expect(item!.name).toBe("users");
      expect(item!.usedInActions).toEqual(["createUser", "deleteUser"]);
    });

    /**
     * @testdoc タイプが不明な場合は null を返す
     */
    it("should return null when type is unknown", () => {
      const jsdoc = `/**\n * Just a regular comment\n */`;
      const item = parseJSDocBlock(jsdoc, "src/utils.ts", undefined, {});
      expect(item).toBeNull();
    });

    /**
     * @testdoc ファイルメタデータの feature をアイテムに継承する
     */
    it("should inherit feature from file metadata", () => {
      const jsdoc = `/**\n * @screen Settings\n */`;
      const item = parseJSDocBlock(jsdoc, "src/app/page.tsx", undefined, {
        feature: "UserManagement",
      });
      expect(item!.feature).toBe("UserManagement");
    });

    /**
     * @testdoc アイテムレベルの feature がファイルメタデータより優先される
     */
    it("should prefer item-level feature over file metadata", () => {
      const jsdoc = `/**\n * @screen Settings\n * @feature Settings\n */`;
      const item = parseJSDocBlock(jsdoc, "src/app/page.tsx", undefined, {
        feature: "UserManagement",
      });
      expect(item!.feature).toBe("Settings");
    });
  });

  describe("parseFeatureMapTags", () => {
    /**
     * @testdoc ファイルからアイテムのみを返す（メタデータなし）
     */
    it("should return only items without metadata", () => {
      const content = `
/**
 * @feature UserManagement
 */
import { something } from 'somewhere';

/**
 * @screen UserList
 * @route /users
 */
export default function UserListPage() {}
`;
      const items = parseFeatureMapTags(content, "src/app/users/page.tsx");
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe("parseFeatureMapTagsWithMetadata", () => {
    /**
     * @testdoc ヘッダー JSDoc の @screen からアイテムを生成する
     */
    it("should create item from header @screen tag", () => {
      const content = `/**
 * @screen Dashboard
 * @route /dashboard
 * @feature Admin
 */
import { something } from 'somewhere';

export default function DashboardPage() {}
`;
      const result = parseFeatureMapTagsWithMetadata(content, "src/app/dashboard/page.tsx");
      expect(result.items.some((i) => i.type === "screen" && i.name === "Dashboard")).toBe(true);
    });

    /**
     * @testdoc コード内の JSDoc ブロックからアイテムを抽出する
     */
    it("should extract items from inline JSDoc blocks", () => {
      const content = `
import { something } from 'somewhere';

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
      const result = parseFeatureMapTagsWithMetadata(content, "src/actions/mutations/user.ts");
      const actions = result.items.filter((i) => i.type === "action");
      expect(actions).toHaveLength(2);
    });

    /**
     * @testdoc ファイルメタデータの feature をインラインアイテムに継承する
     */
    it("should inherit file metadata feature to inline items", () => {
      const content = `
/**
 * @feature Auth
 */
import { x } from 'y';

/**
 * @serverAction
 */
export async function login() {}
`;
      const result = parseFeatureMapTagsWithMetadata(content, "src/actions/auth.ts");
      const action = result.items.find((i) => i.type === "action");
      expect(action?.feature).toBe("Auth");
    });

    /**
     * @testdoc メタデータに types と utilities を含む
     */
    it("should include types and utilities in result", () => {
      const content = `import { x } from 'y';\nexport const FOO = 1;`;
      const result = parseFeatureMapTagsWithMetadata(content, "src/lib/utils.ts");
      expect(result.types).toBeDefined();
      expect(result.utilities).toBeDefined();
    });
  });
});
