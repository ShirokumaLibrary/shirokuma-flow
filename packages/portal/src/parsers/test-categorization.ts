/**
 * test-categorization - テストカテゴリ推定・統計
 *
 * テスト名やファイルパスからカテゴリやモジュール情報を推定し、
 * 統計サマリーを生成する。
 */

import { basename } from "node:path";
import type {
  TestCase,
  TestCategory,
  ModuleInfo,
  FileStats,
  TestSummary,
} from "../commands/test-cases-types.js";

/**
 * テスト名からカテゴリを推定
 *
 * @testCategory アノテーションがない場合のフォールバック
 */
export function inferCategoryFromTestName(itName: string, description?: string): TestCategory {
  const text = `${itName} ${description || ""}`.toLowerCase();

  // 認証・認可関連
  if (
    text.includes("auth") ||
    text.includes("login") ||
    text.includes("logout") ||
    text.includes("認証") ||
    text.includes("ログイン") ||
    text.includes("未認証") ||
    text.includes("unauthorized") ||
    text.includes("forbidden") ||
    text.includes("permission") ||
    text.includes("権限")
  ) {
    return "auth";
  }

  // エラー関連
  if (
    text.includes("error") ||
    text.includes("throw") ||
    text.includes("fail") ||
    text.includes("reject") ||
    text.includes("エラー") ||
    text.includes("失敗")
  ) {
    return "error-handling";
  }

  // バリデーション関連
  if (
    text.includes("valid") ||
    text.includes("invalid") ||
    text.includes("require") ||
    text.includes("missing") ||
    text.includes("empty") ||
    text.includes("バリデーション") ||
    text.includes("必須") ||
    text.includes("入力")
  ) {
    return "validation";
  }

  // エッジケース関連
  if (
    text.includes("edge") ||
    text.includes("boundary") ||
    text.includes("limit") ||
    text.includes("max") ||
    text.includes("min") ||
    text.includes("overflow") ||
    text.includes("エッジ") ||
    text.includes("境界") ||
    text.includes("上限") ||
    text.includes("下限")
  ) {
    return "edge-case";
  }

  // 正常系
  if (
    text.includes("should") ||
    text.includes("success") ||
    text.includes("create") ||
    text.includes("update") ||
    text.includes("delete") ||
    text.includes("get") ||
    text.includes("list") ||
    text.includes("できる") ||
    text.includes("正常") ||
    text.includes("作成") ||
    text.includes("更新") ||
    text.includes("削除") ||
    text.includes("取得") ||
    text.includes("一覧") ||
    text.includes("表示")
  ) {
    return "happy-path";
  }

  return "other";
}

/**
 * テストケースからカテゴリ別統計を計算
 */
export function computeCategoryStats(cases: TestCase[]): Record<TestCategory, number> {
  const stats: Record<TestCategory, number> = {
    "happy-path": 0,
    auth: 0,
    "error-handling": 0,
    validation: 0,
    "edge-case": 0,
    integration: 0,
    other: 0,
  };

  for (const tc of cases) {
    const category = tc.category || inferCategoryFromTestName(tc.it, tc.description);
    stats[category]++;
  }

  return stats;
}

/**
 * テストファイルパスから関連モジュールを推定
 *
 * 推定ルール:
 * - __tests__/lib/actions/*.test.ts → action
 * - __tests__/components/*.test.tsx → component
 * - tests/e2e/*.spec.ts → screen (E2Eは画面テスト)
 *
 * @param file テストファイルの相対パス
 * @param framework テストフレームワーク
 * @returns モジュール情報
 */
export function inferModuleFromPath(file: string, framework: "jest" | "playwright"): ModuleInfo {
  // ファイル名から .test.ts/.test.tsx/.spec.ts を除去
  const fileName = basename(file)
    .replace(/\.test\.(ts|tsx)$/, "")
    .replace(/\.spec\.(ts|tsx|js)$/, "");

  // E2E テスト (Playwright)
  if (framework === "playwright" || file.includes("tests/e2e/") || file.includes("e2e/")) {
    return {
      type: "screen",
      name: fileName,
      detailPath: `details/screens/${fileName}.html`,  // 相対パス（プレフィックスなし）
    };
  }

  // Server Actions テスト
  if (file.includes("__tests__/lib/actions/") || file.includes("/actions/")) {
    return {
      type: "action",
      name: fileName,
      detailPath: `details/actions/${fileName}.html`,  // 相対パス（プレフィックスなし）
    };
  }

  // Components テスト
  if (file.includes("__tests__/components/") || file.includes("/components/")) {
    return {
      type: "component",
      name: fileName,
      detailPath: `details/components/${fileName}.html`,  // 相対パス（プレフィックスなし）
    };
  }

  // その他（不明）
  return {
    type: "unknown",
    name: fileName,
    detailPath: "",
  };
}

/**
 * テストカテゴリを取得
 *
 * @param module モジュール情報
 * @returns カテゴリ名
 */
export function getTestCategory(module: ModuleInfo): "Server Actions" | "Components" | "E2E" | "Other" {
  switch (module.type) {
    case "action":
      return "Server Actions";
    case "component":
      return "Components";
    case "screen":
      return "E2E";
    default:
      return "Other";
  }
}

/**
 * 統計サマリーを作成
 */
export function createSummary(fileStats: FileStats[], testCases: TestCase[]): TestSummary {
  const jestStats = fileStats.filter((f) => f.framework === "jest");
  const playwrightStats = fileStats.filter((f) => f.framework === "playwright");

  return {
    totalFiles: fileStats.length,
    totalTests: testCases.length,
    jestFiles: jestStats.length,
    jestTests: jestStats.reduce((sum, f) => sum + f.tests, 0),
    playwrightFiles: playwrightStats.length,
    playwrightTests: playwrightStats.reduce((sum, f) => sum + f.tests, 0),
    fileStats,
  };
}
