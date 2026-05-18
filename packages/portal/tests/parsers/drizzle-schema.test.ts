import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Drizzle Schema Parser Tests
 *
 * Tests for parsing Drizzle ORM schema files and extracting
 * table, column, foreign key, and index information.
 */

import {
  parseDrizzleSchema,
  toPortalDbSchema,
  type DrizzleSchemaResult,
} from "../../src/parsers/drizzle-schema.js";

describe("drizzle-schema", () => {
  describe("parseDrizzleSchema", () => {
    /**
     * @testdoc 基本的な pgTable 定義からテーブル名と変数名を抽出する
     */
    it("should extract basic table definition", () => {
      const source = `
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
});
`;
      const tables = parseDrizzleSchema(source, "users.ts");
      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe("users");
      expect(tables[0].variableName).toBe("users");
      expect(tables[0].file).toBe("users.ts");
    });

    /**
     * @testdoc カラムの型、制約（primaryKey, notNull, unique）を正しく抽出する
     */
    it("should extract column types and constraints", () => {
      const source = `
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey(),
  title: text("title").notNull(),
  slug: varchar("slug").notNull().unique(),
  content: text("content"),
  views: integer("views").default(0),
});
`;
      const tables = parseDrizzleSchema(source, "posts.ts");
      expect(tables).toHaveLength(1);

      const cols = tables[0].columns;
      expect(cols).toHaveLength(5);

      // id: primaryKey
      const idCol = cols.find((c) => c.name === "id")!;
      expect(idCol.type).toBe("uuid");
      expect(idCol.primaryKey).toBe(true);
      expect(idCol.nullable).toBe(false);

      // title: notNull
      const titleCol = cols.find((c) => c.name === "title")!;
      expect(titleCol.type).toBe("text");
      expect(titleCol.nullable).toBe(false);

      // slug: notNull + unique
      const slugCol = cols.find((c) => c.name === "slug")!;
      expect(slugCol.unique).toBe(true);
      expect(slugCol.nullable).toBe(false);

      // content: nullable (no notNull)
      const contentCol = cols.find((c) => c.name === "content")!;
      expect(contentCol.nullable).toBe(true);

      // views: default(0)
      const viewsCol = cols.find((c) => c.name === "views")!;
      expect(viewsCol.default).toBe("0");
    });

    /**
     * @testdoc JSDoc コメントがある場合にテーブルを正しく抽出する
     */
    it("should extract table even with preceding JSDoc", () => {
      const source = `/** ユーザー管理テーブル */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
});
`;
      const tables = parseDrizzleSchema(source, "users.ts");
      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe("users");
    });

    /**
     * @testdoc JSDoc からカラムの description を抽出する
     */
    it("should extract column JSDoc description", () => {
      const source = `
export const users = pgTable("users", {
  /** ユーザーの一意識別子 */ id: uuid("id").primaryKey(),
  /** 表示名 */ displayName: text("display_name").notNull(),
});
`;
      const tables = parseDrizzleSchema(source, "users.ts");
      const idCol = tables[0].columns.find((c) => c.name === "id")!;
      expect(idCol.description).toBe("ユーザーの一意識別子");
    });

    /**
     * @testdoc references() から外部キーを抽出する
     */
    it("should extract foreign keys from references", () => {
      // FK 正規表現はカラム定義全体を1行でマッチする:
      // varName: type('sqlName')....references(() => refTable.refCol, { onDelete: 'cascade' })
      const source = `
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey(),
  authorId: uuid("author_id").references(() => users.id, { onDelete: 'cascade' }),
});
`;
      const tables = parseDrizzleSchema(source, "schema.ts");
      const postsTable = tables.find((t) => t.name === "posts")!;

      expect(postsTable.foreignKeys).toHaveLength(1);
      expect(postsTable.foreignKeys[0].column).toBe("author_id");
      expect(postsTable.foreignKeys[0].references.table).toBe("users");
      expect(postsTable.foreignKeys[0].references.column).toBe("id");
      expect(postsTable.foreignKeys[0].onDelete).toBe("cascade");
    });

    /**
     * @testdoc インデックス定義を抽出する
     */
    it("should extract index definitions", () => {
      const source = `
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey(),
  slug: varchar("slug").notNull(),
  categoryId: uuid("category_id"),
}, (table) => ({
  slugIdx: uniqueIndex("posts_slug_idx").on(table.slug),
  categoryIdx: index("posts_category_idx").on(table.categoryId),
}));
`;
      const tables = parseDrizzleSchema(source, "posts.ts");
      const indexes = tables[0].indexes;

      expect(indexes).toHaveLength(2);

      const slugIdx = indexes.find((i) => i.name === "posts_slug_idx")!;
      expect(slugIdx.unique).toBe(true);
      expect(slugIdx.columns).toEqual(["slug"]);

      const catIdx = indexes.find((i) => i.name === "posts_category_idx")!;
      expect(catIdx.unique).toBe(false);
      expect(catIdx.columns).toEqual(["category_id"]);
    });

    /**
     * @testdoc 複数テーブルを含むファイルから全テーブルを抽出する
     */
    it("should extract multiple tables from a single file", () => {
      const source = `
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey(),
});

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey(),
});
`;
      const tables = parseDrizzleSchema(source, "schema.ts");
      expect(tables).toHaveLength(3);
      expect(tables.map((t) => t.name)).toEqual(["users", "posts", "comments"]);
    });

    /**
     * @testdoc ...timestamps スプレッドから created_at/updated_at カラムを追加する
     */
    it("should add timestamp columns from spread syntax", () => {
      const source = `
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  ...timestamps,
});
`;
      const tables = parseDrizzleSchema(source, "users.ts");
      const cols = tables[0].columns;

      const createdAt = cols.find((c) => c.name === "created_at");
      expect(createdAt).toBeDefined();
      expect(createdAt!.type).toBe("timestamp");
      expect(createdAt!.nullable).toBe(false);

      const updatedAt = cols.find((c) => c.name === "updated_at");
      expect(updatedAt).toBeDefined();
    });

    /**
     * @testdoc Drizzle 型を SQL 型に正しくマッピングする
     */
    it("should map Drizzle types to SQL types", () => {
      const source = `
export const data = pgTable("data", {
  a: boolean("a"),
  b: jsonb("b"),
  c: doublePrecision("c"),
  d: timestamp("d"),
  e: integer("e"),
});
`;
      const tables = parseDrizzleSchema(source, "data.ts");
      const cols = tables[0].columns;

      expect(cols.find((c) => c.name === "a")!.type).toBe("boolean");
      expect(cols.find((c) => c.name === "b")!.type).toBe("jsonb");
      expect(cols.find((c) => c.name === "c")!.type).toBe("double precision");
      expect(cols.find((c) => c.name === "d")!.type).toBe("timestamp");
      expect(cols.find((c) => c.name === "e")!.type).toBe("integer");
    });

    /**
     * @testdoc ファイル名からカテゴリを推論する
     */
    it("should infer category from file name", () => {
      const source = `
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
});
`;
      expect(parseDrizzleSchema(source, "auth.ts")[0].category).toBe("authentication");
      expect(parseDrizzleSchema(source, "posts.ts")[0].category).toBe("content");
      expect(parseDrizzleSchema(source, "organizations.ts")[0].category).toBe("organizations");
      expect(parseDrizzleSchema(source, "custom.ts")[0].category).toBe("other");
    });

    /**
     * @testdoc テーブル定義がないソースコードに対して空配列を返す
     */
    it("should return empty array for source without table definitions", () => {
      const source = `
import { pgTable } from "drizzle-orm/pg-core";
export const someConst = "hello";
`;
      const tables = parseDrizzleSchema(source, "empty.ts");
      expect(tables).toEqual([]);
    });

    /**
     * @testdoc defaultNow() を含むカラムのデフォルト値を抽出する
     */
    it("should extract defaultNow() as default value", () => {
      const source = `
export const events = pgTable("events", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
`;
      const tables = parseDrizzleSchema(source, "events.ts");
      const col = tables[0].columns.find((c) => c.name === "created_at")!;
      expect(col.default).toBe("now()");
    });

    /**
     * @testdoc camelCase の変数名を snake_case に変換して FK カラム名にする
     */
    it("should convert camelCase reference columns to snake_case", () => {
      const source = `
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey(),
  categoryId: uuid("category_id").references(() => categories.id),
});
`;
      const tables = parseDrizzleSchema(source, "schema.ts");
      const postsTable = tables.find((t) => t.name === "posts")!;
      expect(postsTable.foreignKeys[0].references.column).toBe("id");
    });

    /**
     * @testdoc JSDoc が前方にあり間に他のコードがある場合にテーブルを抽出する
     */
    it("should extract table with JSDoc separated by code", () => {
      const source = `
/** テーブルの説明 */
const someHelper = true;

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
});
`;
      const tables = parseDrizzleSchema(source, "users.ts");
      expect(tables).toHaveLength(1);
      // JSDoc と export の間にコードがあるため description は抽出されない
      expect(tables[0].description).toBeUndefined();
    });

    /**
     * @testdoc インデックス定義が配列形式の場合も抽出する
     */
    it("should extract indexes from array-style definition", () => {
      const source = `
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey(),
  slug: varchar("slug").notNull(),
}, (table) => [
  uniqueIndex("posts_slug_idx").on(table.slug),
]);
`;
      const tables = parseDrizzleSchema(source, "posts.ts");
      expect(tables[0].indexes).toHaveLength(1);
      expect(tables[0].indexes[0].name).toBe("posts_slug_idx");
      expect(tables[0].indexes[0].unique).toBe(true);
    });

    /**
     * @testdoc 複合インデックス（複数カラム）を正しく抽出する
     */
    it("should extract composite index with multiple columns", () => {
      const source = `
export const events = pgTable("events", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id"),
  eventType: varchar("event_type"),
}, (table) => ({
  userEventIdx: index("events_user_event_idx").on(table.userId, table.eventType),
}));
`;
      const tables = parseDrizzleSchema(source, "events.ts");
      const idx = tables[0].indexes[0];
      expect(idx.columns).toEqual(["user_id", "event_type"]);
    });
  });

  describe("toPortalDbSchema", () => {
    /**
     * @testdoc DrizzleSchemaResult を Portal 用 JSON に正しく変換する
     */
    it("should convert DrizzleSchemaResult to portal format", () => {
      const input: DrizzleSchemaResult = {
        tables: [
          {
            name: "users",
            variableName: "users",
            file: "users.ts",
            description: "User table",
            category: "authentication",
            columns: [
              {
                name: "id",
                variableName: "id",
                type: "uuid",
                primaryKey: true,
                nullable: false,
              },
              {
                name: "email",
                variableName: "email",
                type: "text",
                nullable: false,
                unique: true,
              },
            ],
            foreignKeys: [],
            indexes: [
              { name: "users_email_idx", columns: ["email"], unique: true },
            ],
          },
        ],
        generatedAt: "2026-01-01T00:00:00.000Z",
      };

      const result = toPortalDbSchema(input);

      expect(result.generatedAt).toBe("2026-01-01T00:00:00.000Z");
      expect(result.tables).toHaveLength(1);

      const table = result.tables[0];
      expect(table.name).toBe("users");
      expect(table.columnCount).toBe(2);
      expect(table.columns).toHaveLength(2);
      expect(table.indexes).toHaveLength(1);
      expect(table.foreignKeys).toBeUndefined(); // empty FK -> undefined
    });

    /**
     * @testdoc 外部キーがある場合に foreignKeys を含める
     */
    it("should include foreignKeys when present", () => {
      const input: DrizzleSchemaResult = {
        tables: [
          {
            name: "posts",
            variableName: "posts",
            file: "posts.ts",
            columns: [],
            foreignKeys: [
              {
                column: "author_id",
                references: { table: "users", column: "id" },
              },
            ],
            indexes: [],
          },
        ],
        generatedAt: "2026-01-01T00:00:00.000Z",
      };

      const result = toPortalDbSchema(input);
      expect(result.tables[0].foreignKeys).toHaveLength(1);
      expect(result.tables[0].foreignKeys![0].column).toBe("author_id");
    });

    /**
     * @testdoc インデックスがない場合は indexes を undefined にする
     */
    it("should set indexes to undefined when empty", () => {
      const input: DrizzleSchemaResult = {
        tables: [
          {
            name: "simple",
            variableName: "simple",
            file: "simple.ts",
            columns: [],
            foreignKeys: [],
            indexes: [],
          },
        ],
        generatedAt: "2026-01-01T00:00:00.000Z",
      };

      const result = toPortalDbSchema(input);
      expect(result.tables[0].indexes).toBeUndefined();
      expect(result.tables[0].foreignKeys).toBeUndefined();
    });
  });
});
