import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Tests for details-zod.ts
 *
 * Covers: parseZodSchema, mapZodTypeToJsonType
 */

import { parseZodSchema, mapZodTypeToJsonType } from "../../src/parsers/details-zod.js";

describe("details-zod", () => {
  describe("parseZodSchema", () => {
    /**
     * @testdoc 基本的なZodオブジェクトスキーマを解析する
     */
    it("should parse a basic Zod object schema", () => {
      const source = `
const CreateEntitySchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
});
`;
      const result = parseZodSchema("CreateEntitySchema", source);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("CreateEntitySchema");
      expect(result!.parameters).toHaveLength(2);

      const nameParam = result!.parameters.find((p) => p.name === "name");
      expect(nameParam).toBeDefined();
      expect(nameParam!.type).toBe("string");
      expect(nameParam!.required).toBe(true);
      expect(nameParam!.minLength).toBe(1);

      const emailParam = result!.parameters.find((p) => p.name === "email");
      expect(emailParam).toBeDefined();
      expect(emailParam!.format).toBe("email");
    });

    /**
     * @testdoc optionalおよびnullableフィールドを必須でないと判定する
     */
    it("should handle optional fields", () => {
      const source = `
const UpdateSchema = z.object({
  name: z.string().optional(),
  age: z.number().nullable(),
});
`;
      const result = parseZodSchema("UpdateSchema", source);
      expect(result).not.toBeNull();

      const nameParam = result!.parameters.find((p) => p.name === "name");
      expect(nameParam!.required).toBe(false);

      const ageParam = result!.parameters.find((p) => p.name === "age");
      expect(ageParam!.required).toBe(false);
    });

    /**
     * @testdoc describe()メソッドの値をフィールド説明として抽出する
     */
    it("should extract .describe() values", () => {
      const source = `
export const FormSchema = z.object({
  title: z.string().describe("The title of the entity"),
});
`;
      const result = parseZodSchema("FormSchema", source);
      expect(result).not.toBeNull();

      const titleParam = result!.parameters.find((p) => p.name === "title");
      expect(titleParam!.description).toBe("The title of the entity");
    });

    /**
     * @testdoc UUIDフォーマットとバリデーションメッセージを抽出する
     */
    it("should handle uuid format", () => {
      const source = `
const IdSchema = z.object({
  id: z.string().uuid("Invalid UUID"),
});
`;
      const result = parseZodSchema("IdSchema", source);
      expect(result).not.toBeNull();

      const idParam = result!.parameters.find((p) => p.name === "id");
      expect(idParam!.format).toBe("uuid");
      expect(idParam!.validation?.message).toBe("Invalid UUID");
    });

    /**
     * @testdoc default()メソッドのデフォルト値を型ごとに抽出する
     */
    it("should handle .default() values", () => {
      const source = `
const ConfigSchema = z.object({
  enabled: z.boolean().default(true),
  count: z.number().default(10),
  label: z.string().default("default"),
});
`;
      const result = parseZodSchema("ConfigSchema", source);
      expect(result).not.toBeNull();

      const enabledParam = result!.parameters.find((p) => p.name === "enabled");
      expect(enabledParam!.default).toBe(true);

      const countParam = result!.parameters.find((p) => p.name === "count");
      expect(countParam!.default).toBe(10);

      const labelParam = result!.parameters.find((p) => p.name === "label");
      expect(labelParam!.default).toBe("default");
    });

    /**
     * @testdoc z.enum()の列挙値を配列として抽出する
     */
    it("should handle z.enum()", () => {
      const source = `
const StatusSchema = z.object({
  status: z.enum(["active", "inactive", "pending"]),
});
`;
      const result = parseZodSchema("StatusSchema", source);
      expect(result).not.toBeNull();

      const statusParam = result!.parameters.find((p) => p.name === "status");
      expect(statusParam!.type).toBe("enum");
      expect(statusParam!.enum).toEqual(["active", "inactive", "pending"]);
    });

    /**
     * @testdoc 数値型のmin/max制約を最小値・最大値として抽出する
     */
    it("should handle min/max for numbers", () => {
      const source = `
const AgeSchema = z.object({
  age: z.number().min(0).max(150),
});
`;
      const result = parseZodSchema("AgeSchema", source);
      expect(result).not.toBeNull();

      const ageParam = result!.parameters.find((p) => p.name === "age");
      expect(ageParam!.minimum).toBe(0);
      expect(ageParam!.maximum).toBe(150);
    });

    /**
     * @testdoc 文字列型のmin/max制約をminLength/maxLengthとして抽出する
     */
    it("should handle min/max for strings (minLength/maxLength)", () => {
      const source = `
const NameSchema = z.object({
  name: z.string().min(1).max(100),
});
`;
      const result = parseZodSchema("NameSchema", source);
      expect(result).not.toBeNull();

      const nameParam = result!.parameters.find((p) => p.name === "name");
      expect(nameParam!.minLength).toBe(1);
      expect(nameParam!.maxLength).toBe(100);
    });

    /**
     * @testdoc 存在しないスキーマ名に対してnullを返す
     */
    it("should return null for non-existent schema", () => {
      const result = parseZodSchema("NonExistentSchema", "const x = 1;");
      expect(result).toBeNull();
    });

    /**
     * @testdoc exportされたスキーマも正しく解析する
     */
    it("should handle exported schemas", () => {
      const source = `
export const ExportedSchema = z.object({
  value: z.string(),
});
`;
      const result = parseZodSchema("ExportedSchema", source);
      expect(result).not.toBeNull();
      expect(result!.parameters).toHaveLength(1);
    });

    /**
     * @testdoc URLフォーマットのバリデーションを検出する
     */
    it("should handle url format", () => {
      const source = `
const LinkSchema = z.object({
  url: z.string().url(),
});
`;
      const result = parseZodSchema("LinkSchema", source);
      expect(result).not.toBeNull();

      const urlParam = result!.parameters.find((p) => p.name === "url");
      expect(urlParam!.format).toBe("url");
    });
  });

  describe("mapZodTypeToJsonType", () => {
    /**
     * @testdoc 標準的なZod型をJSON型に正しくマッピングする
     */
    it("should map standard Zod types", () => {
      expect(mapZodTypeToJsonType("string")).toBe("string");
      expect(mapZodTypeToJsonType("number")).toBe("number");
      expect(mapZodTypeToJsonType("boolean")).toBe("boolean");
      expect(mapZodTypeToJsonType("date")).toBe("string");
      expect(mapZodTypeToJsonType("array")).toBe("array");
      expect(mapZodTypeToJsonType("object")).toBe("object");
      expect(mapZodTypeToJsonType("enum")).toBe("enum");
    });

    /**
     * @testdoc 未知の型に対してunknownを返す
     */
    it("should return 'unknown' for unmapped types", () => {
      expect(mapZodTypeToJsonType("customType")).toBe("unknown");
      expect(mapZodTypeToJsonType("")).toBe("unknown");
    });
  });
});
