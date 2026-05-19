/**
 * lint-structure コマンドの型定義
 *
 * プロジェクト構造検証のための型
 */
/**
 * 検証結果のステータス
 */
export type CheckStatus = "pass" | "error" | "warning" | "info";
/**
 * 重要度
 */
export type Severity = "error" | "warning" | "info";
/**
 * ルールID
 */
export type StructureRuleId = "dir-required" | "file-required" | "dir-recommended" | "lib-no-root-files" | "lib-has-index" | "actions-structure" | "naming-convention" | "no-cross-app-import" | "components-domain-grouping" | "lib-structure-compliance" | "barrel-export-required" | "actions-separation";
/**
 * 単一のチェック結果
 */
export interface StructureCheck {
    rule: StructureRuleId;
    target: string;
    status: CheckStatus;
    message?: string;
    found?: string[];
    violations?: Array<{
        path: string;
        expected?: string;
        actual?: string;
    }>;
    fix?: string;
}
/**
 * アプリの検証結果
 */
export interface AppStructureReport {
    name: string;
    path: string;
    passed: boolean;
    checks: StructureCheck[];
}
/**
 * パッケージの検証結果
 */
export interface PackageStructureReport {
    name: string;
    path: string;
    passed: boolean;
    checks: StructureCheck[];
}
/**
 * 推奨アクション
 */
export interface RecommendedAction {
    priority: number;
    action: string;
    reason: string;
    rule: StructureRuleId;
    target: string;
}
/**
 * サマリー
 */
export interface StructureSummary {
    passed: boolean;
    totalChecks: number;
    errors: number;
    warnings: number;
    info: number;
}
/**
 * メタ情報
 */
export interface StructureMeta {
    command: "lint-structure";
    project: string;
    timestamp: string;
    version: string;
}
/**
 * 完全なレポート
 */
export interface LintStructureReport {
    meta: StructureMeta;
    summary: StructureSummary;
    apps: AppStructureReport[];
    packages: PackageStructureReport[];
    recommendedActions: RecommendedAction[];
}
/**
 * ディレクトリ必須ルール設定
 */
export interface DirRequiredRuleConfig {
    severity: Severity;
    apps?: string[];
    packages?: Record<string, string[]>;
}
/**
 * ファイル必須ルール設定
 */
export interface FileRequiredRuleConfig {
    severity: Severity;
    apps?: string[];
    packages?: Record<string, string[]>;
}
/**
 * lib直下禁止ルール設定
 */
export interface LibNoRootFilesRuleConfig {
    severity: Severity;
    enabled: boolean;
}
/**
 * index.ts必須ルール設定
 */
export interface LibHasIndexRuleConfig {
    severity: Severity;
    enabled: boolean;
}
/**
 * 推奨ディレクトリルール設定
 */
export interface DirRecommendedRuleConfig {
    severity: Severity;
    apps?: string[];
}
/**
 * 命名規則ルール設定
 */
export interface NamingConventionRuleConfig {
    severity: Severity;
    enabled: boolean;
    rules?: {
        domainDirs?: "PascalCase" | "camelCase" | "kebab-case";
        components?: "PascalCase" | "camelCase";
        actions?: "PascalCase" | "camelCase";
        routeGroups?: "lowercase" | "PascalCase";
    };
}
/**
 * Cross-app import禁止ルール設定
 */
export interface NoCrossAppImportRuleConfig {
    severity: Severity;
    enabled: boolean;
}
/**
 * components/ ドメイン別グループ化ルール設定
 */
export interface ComponentsDomainGroupingRuleConfig {
    severity: Severity;
    enabled: boolean;
    /** システムディレクトリ（除外対象） */
    systemDirs?: string[];
}
/**
 * lib/構造準拠ルール設定
 */
export interface LibStructureComplianceRuleConfig {
    severity: Severity;
    enabled: boolean;
    /** 許可されるlib/直下のディレクトリ */
    allowedDirs?: string[];
    /** context/ と contexts/ の混在を禁止 */
    disallowContextMixing?: boolean;
}
/**
 * バレルエクスポート必須ルール設定
 */
export interface BarrelExportRequiredRuleConfig {
    severity: Severity;
    enabled: boolean;
    /** 対象ディレクトリ */
    targetDirs?: string[];
    /** 除外ディレクトリ */
    excludeDirs?: string[];
    /** 最小ファイル数（この数以上のファイルがあるディレクトリのみ） */
    minFiles?: number;
}
/**
 * actions分離ルール設定
 */
export interface ActionsSeparationRuleConfig {
    severity: Severity;
    enabled: boolean;
    /** crud/からdomain/へのインポートを禁止 */
    disallowCrudToDomain?: boolean;
}
/**
 * 全ルール設定
 */
export interface StructureRulesConfig {
    "dir-required"?: DirRequiredRuleConfig;
    "file-required"?: FileRequiredRuleConfig;
    "lib-no-root-files"?: LibNoRootFilesRuleConfig;
    "lib-has-index"?: LibHasIndexRuleConfig;
    "dir-recommended"?: DirRecommendedRuleConfig;
    "naming-convention"?: NamingConventionRuleConfig;
    "no-cross-app-import"?: NoCrossAppImportRuleConfig;
    "components-domain-grouping"?: ComponentsDomainGroupingRuleConfig;
    "lib-structure-compliance"?: LibStructureComplianceRuleConfig;
    "barrel-export-required"?: BarrelExportRequiredRuleConfig;
    "actions-separation"?: ActionsSeparationRuleConfig;
}
/**
 * lint-structure 設定
 */
export interface LintStructureConfig {
    enabled: boolean;
    strict?: boolean;
    excludeApps?: string[];
    rules?: StructureRulesConfig;
}
export declare const defaultLintStructureConfig: LintStructureConfig;
//# sourceMappingURL=structure-types.d.ts.map