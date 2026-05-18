/**
 * @fileoverview dev-preset スモークテスト
 * 各プリセットを import してエラーなく構造を取得できることを確認する
 */
import { describe, it, expect } from "@jest/globals";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

describe("dev-preset スモークテスト", () => {
  describe("ベース ESLint config", () => {
    it("import してデフォルトエクスポートが配列であること", async () => {
      const mod = await import("../eslint.js");
      const config = mod.default;
      expect(Array.isArray(config)).toBe(true);
      expect(config.length).toBeGreaterThan(0);
    });
  });

  describe("ベース Prettier config", () => {
    it("import してデフォルトエクスポートがオブジェクトであること", async () => {
      const mod = await import("../prettier.js");
      const config = mod.default;
      expect(typeof config).toBe("object");
      expect(config).not.toBeNull();
    });

    it("必須フィールドを持つこと", async () => {
      const mod = await import("../prettier.js");
      const config = mod.default;
      expect(config).toHaveProperty("semi");
      expect(config).toHaveProperty("tabWidth");
      expect(config).toHaveProperty("trailingComma");
    });
  });

  describe("Next.js ESLint config", () => {
    it("import してデフォルトエクスポートが配列であること", async () => {
      const mod = await import("../presets/nextjs/eslint.js");
      const config = mod.default;
      expect(Array.isArray(config)).toBe(true);
    });
  });

  describe("Next.js Prettier config", () => {
    it("import してデフォルトエクスポートがオブジェクトであること", async () => {
      const mod = await import("../presets/nextjs/prettier.js");
      const config = mod.default;
      expect(typeof config).toBe("object");
      expect(config).not.toBeNull();
    });

    it("Tailwind plugin が含まれること", async () => {
      const mod = await import("../presets/nextjs/prettier.js");
      const config = mod.default;
      expect(config).toHaveProperty("plugins");
      expect(Array.isArray(config.plugins)).toBe(true);
      expect(config.plugins).toContain("prettier-plugin-tailwindcss");
    });
  });

  describe("tsconfig exports", () => {
    it("base tsconfig がパース可能な JSON であること", () => {
      const path = resolve(here, "../tsconfig.base.json");
      expect(existsSync(path)).toBe(true);
      const parsed = JSON.parse(readFileSync(path, "utf-8"));
      expect(parsed).toHaveProperty("compilerOptions");
    });

    it("Next.js tsconfig がパース可能な JSON で base を継承すること", () => {
      const path = resolve(here, "../presets/nextjs/tsconfig.json");
      expect(existsSync(path)).toBe(true);
      const parsed = JSON.parse(readFileSync(path, "utf-8"));
      expect(parsed).toHaveProperty("extends");
      expect(parsed.compilerOptions.module).toBe("esnext");
    });
  });
});
