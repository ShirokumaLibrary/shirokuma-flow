/**
 * test-cases スタイル・スクリプト・ユーティリティ
 *
 * テストケース HTML ページ用の CSS、JavaScript、
 * および共有ユーティリティ関数。
 */
import type { TestCategory } from "../commands/test-cases-types.js";
/**
 * ファイルパスを ID に変換
 */
export declare function fileToId(file: string): string;
/**
 * 配列をキーでグループ化
 */
export declare function groupBy<T>(array: T[], keyFn: (item: T) => string): Map<string, T[]>;
/**
 * カテゴリスラッグを生成
 */
export declare function categoryToSlug(category: string): string;
/**
 * ファイル名からスラッグを生成
 */
export declare function fileToSlug(file: string): string;
/**
 * カテゴリ別のアイコンを取得
 */
export declare function getCategoryIcon(category: string): string;
/**
 * カテゴリ別の色クラスを取得
 */
export declare function getCategoryColor(category: string): string;
/**
 * テストカテゴリのバッジを生成
 */
export declare function getCategoryBadgeHtml(category: TestCategory, count: number): string;
/**
 * グローバルナビ用のHTML要素を取得
 * @param depth - ディレクトリ階層深度（1: test-cases/, 2: test-cases/category/）
 */
export declare function getGlobalNavElements(depth: number): {
    headElements: string;
    bodyEndScripts: string;
};
/**
 * サイドバー用スタイル
 */
export declare function getSidebarStyles(): string;
/**
 * 検索スクリプト
 */
export declare function getSearchScript(): string;
/**
 * カテゴリ一覧ページのスタイル
 */
export declare function getCategoryListStyles(): string;
/**
 * ファイル一覧ページのスタイル
 */
export declare function getFileListStyles(): string;
/**
 * テスト詳細ページのスタイル
 */
export declare function getTestDetailStyles(): string;
//# sourceMappingURL=test-cases-styles.d.ts.map