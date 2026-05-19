/**
 * details コマンド - 詳細ページ生成
 *
 * feature-map.json, test-cases.json, linked-docs.json を読み込み、
 * 各要素（Screen, Component, Action, Table）の詳細ページを生成する。
 *
 * ロジックは以下のモジュールに分割:
 * - details-types.ts: 型定義
 * - details-context.ts: コンテキスト管理・リンク解決
 * - details-jsdoc.ts: JSDoc解析
 * - details-zod.ts: Zodスキーマ解析
 * - details-test-analysis.ts: テスト分析
 * - details-styles.ts: CSS・スクリプト
 * - details-html.ts: コアHTML生成
 * - details-entity-pages.ts: エンティティ詳細ページ
 * - details-module-page.ts: モジュール概要ページ
 */
import type { DetailsOptions } from "./details-types.js";
/**
 * details コマンドのメインハンドラ
 */
export declare function detailsCommand(options: DetailsOptions): number;
//# sourceMappingURL=details.d.ts.map