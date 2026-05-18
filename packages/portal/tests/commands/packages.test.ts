import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Packages Command Tests
 *
 * Tests for the packages documentation generation functionality.
 * Scans monorepo packages and generates documentation data.
 *
 * @testdoc パッケージドキュメント生成機能をテスト
 */

import {
  scanPackageModules,
  buildPackagesData,
  type PackageModuleData,
  type PackageScanResult,
} from "../../src/commands/packages.js";

describe("Packages Command", () => {
  describe("scanPackageModules", () => {
    /**
     * @testdoc パッケージのモジュールをスキャンできる
     */
    it("should scan package modules from TypeScript files", () => {
      const content = `
/**
 * @module auth
 * Authentication utilities
 */

export function verifyToken(token: string): boolean {
  return true;
}

export interface User {
  id: string;
  name: string;
}

export const DEFAULT_TIMEOUT = 5000;
`;
      const result = scanPackageModules(content, "src/auth.ts");

      expect(result).not.toBeNull();
      expect(result!.name).toBe("auth");
      expect(result!.exports.length).toBeGreaterThan(0);
    });

    /**
     * @testdoc エクスポートされた関数を検出できる
     */
    it("should detect exported functions", () => {
      const content = `
/**
 * Hash a password
 */
export function hashPassword(password: string): string {
  return password;
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return true;
}
`;
      const result = scanPackageModules(content, "src/password.ts");

      expect(result).not.toBeNull();
      const functions = result!.exports.filter((e) => e.kind === "function");
      expect(functions.length).toBe(2);
      expect(functions.map((f) => f.name)).toContain("hashPassword");
      expect(functions.map((f) => f.name)).toContain("verifyPassword");
    });

    /**
     * @testdoc エクスポートされた型を検出できる
     */
    it("should detect exported types and interfaces", () => {
      const content = `
export interface User {
  id: string;
  name: string;
}

export type UserId = string;

export type UserRole = "admin" | "user" | "guest";
`;
      const result = scanPackageModules(content, "src/types.ts");

      expect(result).not.toBeNull();
      const types = result!.exports.filter((e) => e.kind === "type" || e.kind === "interface");
      expect(types.length).toBe(3);
    });

    /**
     * @testdoc エクスポートされた定数を検出できる
     */
    it("should detect exported constants", () => {
      const content = `
export const API_VERSION = "v1";
export const MAX_RETRIES = 3;
export const config = { timeout: 5000 };
`;
      const result = scanPackageModules(content, "src/constants.ts");

      expect(result).not.toBeNull();
      const constants = result!.exports.filter((e) => e.kind === "const");
      expect(constants.length).toBe(3);
    });

    /**
     * @testdoc ファイルにエクスポートがない場合はnullを返す
     */
    it("should return null for files without exports", () => {
      const content = `
const privateVar = "test";

function privateFunction() {
  return "private";
}
`;
      const result = scanPackageModules(content, "src/private.ts");

      // null or empty exports
      expect(result === null || result.exports.length === 0).toBe(true);
    });
  });

  describe("buildPackagesData", () => {
    /**
     * @testdoc 空のパッケージリストでも正しくデータを構築できる
     */
    it("should build data for empty package list", () => {
      const result = buildPackagesData([]);

      expect(result.packages).toHaveLength(0);
      expect(result.summary.totalPackages).toBe(0);
      expect(result.summary.totalModules).toBe(0);
      expect(result.summary.totalExports).toBe(0);
      expect(result.generatedAt).toBeDefined();
    });

    /**
     * @testdoc パッケージの統計情報を正しく計算できる
     */
    it("should calculate package statistics correctly", () => {
      const scanResults: PackageScanResult[] = [
        {
          name: "shared",
          path: "packages/shared",
          prefix: "@repo/shared",
          modules: [
            {
              name: "utils",
              path: "src/utils.ts",
              exports: [
                { name: "formatDate", kind: "function" },
                { name: "parseDate", kind: "function" },
              ],
              dependencies: [],
            },
            {
              name: "types",
              path: "src/types.ts",
              exports: [
                { name: "User", kind: "interface" },
                { name: "UserId", kind: "type" },
              ],
              dependencies: [],
            },
          ],
        },
      ];

      const result = buildPackagesData(scanResults);

      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].stats.moduleCount).toBe(2);
      expect(result.packages[0].stats.exportCount).toBe(4);
      expect(result.packages[0].stats.functionCount).toBe(2);
      expect(result.packages[0].stats.typeCount).toBe(2);
      expect(result.summary.totalPackages).toBe(1);
      expect(result.summary.totalModules).toBe(2);
      expect(result.summary.totalExports).toBe(4);
    });

    /**
     * @testdoc 複数パッケージのサマリーを正しく計算できる
     */
    it("should calculate summary for multiple packages", () => {
      const scanResults: PackageScanResult[] = [
        {
          name: "pkg1",
          path: "packages/pkg1",
          prefix: "@repo/pkg1",
          modules: [
            {
              name: "mod1",
              path: "src/mod1.ts",
              exports: [{ name: "fn1", kind: "function" }],
              dependencies: [],
            },
          ],
        },
        {
          name: "pkg2",
          path: "packages/pkg2",
          prefix: "@repo/pkg2",
          modules: [
            {
              name: "mod2",
              path: "src/mod2.ts",
              exports: [
                { name: "fn2", kind: "function" },
                { name: "Type2", kind: "type" },
              ],
              dependencies: [],
            },
          ],
        },
      ];

      const result = buildPackagesData(scanResults);

      expect(result.summary.totalPackages).toBe(2);
      expect(result.summary.totalModules).toBe(2);
      expect(result.summary.totalExports).toBe(3);
    });
  });
});
