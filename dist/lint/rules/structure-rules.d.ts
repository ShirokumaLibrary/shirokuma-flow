/**
 * 構造検証ルール
 *
 * プロジェクトのディレクトリ構造を検証するルール群
 *
 * @module lint/rules/structure-rules
 */
import type { StructureCheck, Severity, LibNoRootFilesRuleConfig, LibHasIndexRuleConfig, NamingConventionRuleConfig, NoCrossAppImportRuleConfig, ComponentsDomainGroupingRuleConfig, LibStructureComplianceRuleConfig, BarrelExportRequiredRuleConfig, ActionsSeparationRuleConfig } from "../structure-types.js";
/**
 * ディレクトリ必須ルール
 */
export declare function checkDirRequired(basePath: string, dirs: string[], severity: Severity): StructureCheck[];
/**
 * ファイル必須ルール
 */
export declare function checkFileRequired(basePath: string, files: string[], severity: Severity): StructureCheck[];
/**
 * lib/ 直下ファイル禁止ルール
 */
export declare function checkLibNoRootFiles(basePath: string, config: LibNoRootFilesRuleConfig): StructureCheck[];
/**
 * lib/ サブディレクトリに index.ts 必須ルール
 */
export declare function checkLibHasIndex(basePath: string, config: LibHasIndexRuleConfig): StructureCheck[];
/**
 * 推奨ディレクトリルール
 */
export declare function checkDirRecommended(basePath: string, dirs: string[], severity: Severity): StructureCheck[];
/**
 * 命名規則チェック
 */
export declare function checkNamingConvention(basePath: string, config: NamingConventionRuleConfig): StructureCheck[];
/**
 * Cross-app import 禁止ルール
 */
export declare function checkNoCrossAppImport(projectPath: string, appName: string, config: NoCrossAppImportRuleConfig): StructureCheck[];
/**
 * actions/ 構造チェック（crud/, domain/ パターン）
 */
export declare function checkActionsStructure(basePath: string, severity: Severity): StructureCheck[];
/**
 * components/ ドメイン別グループ化チェック
 *
 * components/ 直下にフラットなコンポーネントファイルがないかチェック。
 * ドメイン別のサブディレクトリ（例: Post/, Category/）に整理することを推奨。
 */
export declare function checkComponentsDomainGrouping(basePath: string, config: ComponentsDomainGroupingRuleConfig): StructureCheck[];
/**
 * lib/ 構造準拠チェック
 *
 * lib/ 直下に許可されたディレクトリのみ存在するかチェック。
 * context/ と contexts/ の混在も検出。
 */
export declare function checkLibStructureCompliance(basePath: string, config: LibStructureComplianceRuleConfig): StructureCheck[];
/**
 * バレルエクスポート必須チェック
 *
 * 複数ファイルを持つディレクトリに index.ts が存在するかチェック。
 */
export declare function checkBarrelExportRequired(basePath: string, config: BarrelExportRequiredRuleConfig): StructureCheck[];
/**
 * actions分離チェック
 *
 * lib/actions/crud/ が lib/actions/domain/ をインポートしていないかチェック。
 */
export declare function checkActionsSeparation(basePath: string, config: ActionsSeparationRuleConfig): StructureCheck[];
//# sourceMappingURL=structure-rules.d.ts.map