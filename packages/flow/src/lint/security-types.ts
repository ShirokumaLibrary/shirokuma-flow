/**
 * lint-security 用型定義
 *
 * 依存パッケージの脆弱性チェックに使用する型
 */

/**
 * 脆弱性の重大度
 */
export type VulnerabilitySeverity = "critical" | "high" | "moderate" | "low" | "info";

/**
 * 検出された脆弱性
 */
export interface VulnerabilityItem {
  /** パッケージ名 */
  name: string;
  /** 脆弱性の重大度 */
  severity: VulnerabilitySeverity;
  /** 脆弱性の説明 */
  description: string;
  /** 影響を受けるバージョン範囲 */
  range?: string;
  /** 修正バージョン */
  fixedIn?: string;
  /** 修正可能か */
  fixAvailable: boolean;
  /** CVE ID（複数可） */
  cveIds?: string[];
  /** devDependency かどうか */
  isDev: boolean;
  /** 依存パス（なぜ依存しているか） */
  via?: string[];
}

/**
 * パッケージマネージャーの種別
 */
export type PackageManager = "npm" | "pnpm" | "yarn";

/**
 * セキュリティ監査レポート
 */
export interface SecurityAuditReport {
  /** 使用したパッケージマネージャー */
  packageManager: PackageManager;
  /** 検出された脆弱性一覧 */
  vulnerabilities: VulnerabilityItem[];
  /** サマリー */
  summary: {
    /** critical 件数 */
    critical: number;
    /** high 件数 */
    high: number;
    /** moderate 件数 */
    moderate: number;
    /** low 件数 */
    low: number;
    /** info 件数 */
    info: number;
    /** エラー件数（critical + high） */
    errorCount: number;
    /** 警告件数（moderate + low） */
    warningCount: number;
    /** 合計件数 */
    total: number;
  };
  /** ネットワークエラー等でスキップされたか */
  skipped: boolean;
  /** スキップ理由 */
  skipReason?: string;
  /** 合格したか（errorCount === 0） */
  passed: boolean;
}
