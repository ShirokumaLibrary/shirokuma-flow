/**
 * Drizzle ORM スキーマパーサー
 *
 * TypeScript スキーマファイルを直接パースしてテーブル情報を抽出。
 * drizzle-dbml-generator が利用できない場合のフォールバック。
 *
 * @module parsers/drizzle-schema
 */
import { type Logger } from "../utils/logger.js";
export interface DrizzleTable {
    name: string;
    variableName: string;
    file: string;
    description?: string;
    category?: string;
    columns: DrizzleColumn[];
    foreignKeys: DrizzleForeignKey[];
    indexes: DrizzleIndex[];
}
export interface DrizzleColumn {
    name: string;
    variableName: string;
    type: string;
    primaryKey?: boolean;
    nullable: boolean;
    unique?: boolean;
    default?: string;
    description?: string;
}
export interface DrizzleForeignKey {
    column: string;
    references: {
        table: string;
        column: string;
    };
    onDelete?: string;
    onUpdate?: string;
}
export interface DrizzleIndex {
    name: string;
    columns: string[];
    unique?: boolean;
    description?: string;
}
export interface DrizzleSchemaResult {
    tables: DrizzleTable[];
    generatedAt: string;
}
/**
 * スキーマディレクトリからすべてのテーブルを抽出
 */
export declare function parseDrizzleSchemaDir(schemaDir: string, logger?: Logger): DrizzleSchemaResult;
/**
 * 単一スキーマファイルからテーブルを抽出
 */
export declare function parseDrizzleSchema(sourceCode: string, filePath: string, logger?: Logger): DrizzleTable[];
export interface PortalDbSchemaTable {
    name: string;
    file?: string;
    description?: string;
    category?: string;
    columnCount: number;
    columns?: {
        name: string;
        type: string;
        primaryKey?: boolean;
        nullable: boolean;
        unique?: boolean;
        default?: string;
        description?: string;
    }[];
    foreignKeys?: {
        column: string;
        references: {
            table: string;
            column: string;
        };
    }[];
    indexes?: {
        name: string;
        columns?: string[];
        unique?: boolean;
    }[];
}
/**
 * DrizzleSchemaResult を Portal 用 JSON に変換
 */
export declare function toPortalDbSchema(result: DrizzleSchemaResult): {
    tables: PortalDbSchemaTable[];
    generatedAt: string;
};
//# sourceMappingURL=drizzle-schema.d.ts.map