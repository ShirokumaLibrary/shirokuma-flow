/**
 * テストケースページジェネレーター
 */
import type { PortalData } from "../types.js";
/**
 * テストケース一覧ページの HTML を生成する
 */
export declare function generateTestCasesPage(data: PortalData): string;
/**
 * テストケースファイル詳細ページの HTML を生成する
 */
export declare function generateTestCasesFilePage(data: PortalData, fileSlug: string): string;
/**
 * テストケース詳細ページ（1件）の HTML を生成する
 */
export declare function generateTestCaseDetailPage(data: PortalData, fileSlug: string, line: number): string;
//# sourceMappingURL=test-cases.d.ts.map