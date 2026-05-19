/**
 * test-categorization - テストカテゴリ推定・統計
 *
 * テスト名やファイルパスからカテゴリやモジュール情報を推定し、
 * 統計サマリーを生成する。
 */
import type { TestCase, TestCategory, ModuleInfo, FileStats, TestSummary } from "../commands/test-cases-types.js";
/**
 * テスト名からカテゴリを推定
 *
 * @testCategory アノテーションがない場合のフォールバック
 */
export declare function inferCategoryFromTestName(itName: string, description?: string): TestCategory;
/**
 * テストケースからカテゴリ別統計を計算
 */
export declare function computeCategoryStats(cases: TestCase[]): Record<TestCategory, number>;
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
export declare function inferModuleFromPath(file: string, framework: "jest" | "playwright"): ModuleInfo;
/**
 * テストカテゴリを取得
 *
 * @param module モジュール情報
 * @returns カテゴリ名
 */
export declare function getTestCategory(module: ModuleInfo): "Server Actions" | "Components" | "E2E" | "Other";
/**
 * 統計サマリーを作成
 */
export declare function createSummary(fileStats: FileStats[], testCases: TestCase[]): TestSummary;
//# sourceMappingURL=test-categorization.d.ts.map