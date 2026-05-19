/**
 * projects setup subcommand
 *
 * Status/Priority/Size field initial setup.
 */
import { Logger } from "../../utils/logger.js";
import { ProjectsOptions } from "./helpers.js";
/**
 * GraphQL の singleSelectOptions 配列を組み立てる
 */
export declare function buildSingleSelectOptions(colors: Record<string, string>, descriptions: Record<string, string>): string;
/** setup サブコマンドのオプション */
export interface SetupOptions extends ProjectsOptions {
    lang?: string;
    fieldId?: string;
    projectId?: string;
    statusOnly?: boolean;
    dryRun?: boolean;
}
/**
 * 定義済みオプションと既存オプションの差分を検出する。
 * ユニットテスト可能な純粋関数。
 */
export declare function detectOptionDiff(existingNames: string[], definedNames: string[]): {
    missing: string[];
    extra: string[];
};
/**
 * setup subcommand - Status/Priority/Size フィールドの初期設定
 */
export declare function cmdSetup(options: SetupOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=setup.d.ts.map