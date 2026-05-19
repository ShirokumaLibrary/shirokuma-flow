/**
 * feature-map スタイル・スクリプト・設定
 *
 * feature-map HTML ページ用の CSS スタイルと JavaScript、
 * および設定解決ロジック。
 */
import type { ExternalDocConfig, ResolvedFeatureMapConfig, FeatureMap } from "../commands/feature-map-types.js";
/**
 * デフォルト設定を取得
 */
export declare function getDefaultFeatureMapConfig(): ResolvedFeatureMapConfig;
/**
 * 設定を解決
 */
export declare function resolveFeatureMapConfig(config?: {
    enabled?: boolean;
    include?: string[];
    exclude?: string[];
    externalDocs?: ExternalDocConfig[];
    storybook?: {
        enabled?: boolean;
        url?: string;
        pathTemplate?: string;
        label?: string;
    };
}): ResolvedFeatureMapConfig;
/**
 * ファイルを収集
 */
export declare function collectFiles(projectPath: string, config: ResolvedFeatureMapConfig): string[];
/**
 * スタイル
 */
export declare function getStyles(): string;
/**
 * スクリプト
 */
export declare function getScripts(_featureMap: FeatureMap, _config: ResolvedFeatureMapConfig): string;
//# sourceMappingURL=feature-map-styles.d.ts.map