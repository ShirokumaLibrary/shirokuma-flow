/**
 * details-module-page - モジュール詳細ページ生成
 *
 * モジュール単位の概要ページ（型定義・ユーティリティ・テスト一覧）を生成する。
 */
import type { ModulePageData, Screen, Component, Action, Table, TypeItem, UtilityItem, CategorizedTestCase } from "../commands/details-types.js";
/**
 * モジュールのテストリストをHTMLで生成
 *
 * @description テストケースをファイル別にグループ化し、test-cases.htmlへのリンク付きで表示
 */
export declare function buildModuleTestsList(testCases: CategorizedTestCase[], _moduleName: string): string;
/**
 * モジュール詳細ページを生成
 */
export declare function generateModuleDetailPage(data: ModulePageData, detailsDir: string): void;
/**
 * アイテムのメタ情報を取得
 */
export declare function getItemMeta(type: string, item: Screen | Component | Action | Table): string;
/**
 * モジュールの統計情報を取得
 */
export declare function getModuleStats(type: string, items: (Screen | Component | Action | Table)[]): string;
/**
 * 型定義アイテムをHTMLで生成
 */
export declare function buildTypeItem(type: TypeItem): string;
/**
 * ユーティリティアイテム（定数・関数）をHTMLで生成
 */
export declare function buildUtilityItem(util: UtilityItem): string;
//# sourceMappingURL=details-module-page.d.ts.map