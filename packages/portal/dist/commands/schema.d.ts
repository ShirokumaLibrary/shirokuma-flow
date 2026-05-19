/**
 * schema コマンド - DB スキーマドキュメント生成 (DBML, SVG)
 *
 * Drizzle ORM スキーマから以下を生成:
 * - schema.dbml - DBML ソースファイル
 * - schema.svg - ER 図 (SVG)
 * - schema-docs.md - テーブル説明 Markdown
 */
import { type ShirokumaConfig } from "../utils/config.js";
interface SchemaOptions {
    project: string;
    config: string;
    output?: string;
    verbose?: boolean;
}
/**
 * 正規化されたスキーマ設定
 */
export interface NormalizedSchemaConfig {
    /** データベース識別子（pathから自動取得） */
    name: string;
    /** データベースの説明 */
    description?: string;
    /** スキーマソースディレクトリ（絶対パス） */
    source: string;
    /** 出力ディレクトリ（絶対パス） */
    output: string;
    /** スキーマファイルパターン */
    pattern: string;
}
/**
 * パスからDB名を取得
 *
 * @example
 * getDbNameFromPath("packages/database/src/schema") // -> "database"
 * getDbNameFromPath("packages/analytics-db/src/schema") // -> "analytics-db"
 * getDbNameFromPath("./src/schema") // -> "schema"
 */
export declare function getDbNameFromPath(path: string): string;
/**
 * 設定から正規化されたスキーマ設定リストを取得
 */
export declare function normalizeSchemaConfigs(config: ShirokumaConfig, projectPath: string): NormalizedSchemaConfig[];
/**
 * schema コマンドハンドラ
 */
export declare function schemaCommand(options: SchemaOptions): Promise<number>;
export {};
//# sourceMappingURL=schema.d.ts.map