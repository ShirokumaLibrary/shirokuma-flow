import type { ContextsConfig } from './config-types.js';
/** 設定ファイルの正規パス（プロジェクトルートからの相対）。 */
export declare const CONFIG_FILE = ".shirokuma/config.yaml";
interface ContextsOnlyConfig {
    contexts?: ContextsConfig;
}
/**
 * `.shirokuma/config.yaml` から contexts 設定を読み込む。
 * ファイル不在・パース失敗のいずれでも空オブジェクトを返す。
 *
 * @param projectPath - プロジェクトルートの絶対パス
 */
export declare function loadContextsConfig(projectPath: string): ContextsOnlyConfig;
export {};
//# sourceMappingURL=config.d.ts.map