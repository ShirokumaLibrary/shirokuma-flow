/**
 * DB スキーマページジェネレーター
 */
import type { PortalData } from "../types.js";
/**
 * DB スキーマ一覧ページの HTML を生成する
 */
export declare function generateDbSchemaPage(data: PortalData): string;
/**
 * 特定 DB のスキーマページを生成する
 */
export declare function generateDbSchemaDbPage(data: PortalData, dbName: string): string;
/**
 * テーブル詳細ページを生成する
 */
export declare function generateDbSchemaTablePage(data: PortalData, tableName: string): string;
/**
 * DB ER 図ページを生成する
 */
export declare function generateDbDiagramPage(data: PortalData, dbName?: string): string;
//# sourceMappingURL=db-schema.d.ts.map