/**
 * lint-security コマンド - 依存パッケージ脆弱性チェック
 *
 * パッケージマネージャー（npm / pnpm / yarn）を自動検出し、
 * audit コマンドを実行して脆弱性を検出・報告する。
 *
 * 方針:
 * - lockfile の存在でパッケージマネージャーを自動判定
 * - audit JSON 出力をパース、共通型 VulnerabilityItem に正規化
 * - critical / high はエラー、moderate / low は警告
 * - dev dependency の脆弱性は warning 扱い（production より低重要度）
 * - ネットワークエラー時は warning + skip（lint 全体をブロックしない）
 */
import type { VulnerabilityItem, PackageManager } from "../../lint/security-types.js";
/**
 * コマンドオプション
 */
interface LintSecurityOptions {
    project: string;
    config?: string;
    format?: "terminal" | "json" | "summary";
    output?: string;
    strict?: boolean;
    verbose?: boolean;
    /** 最小 severity 閾値 (critical, high, moderate, low) */
    severity?: string;
}
/**
 * lockfile の存在からパッケージマネージャーを検出する
 */
export declare function detectPackageManager(projectPath: string): PackageManager;
/**
 * audit コマンドを実行し JSON 文字列を返す
 *
 * audit コマンドは脆弱性検出時に exit code 非ゼロを返すため、
 * execSync のエラーから stdout を取り出す。
 * ネットワーク未接続等の真のエラーは ENETUNREACH / ENOTFOUND 等で判断。
 */
export declare function runAudit(pm: PackageManager, projectPath: string): {
    output: string;
    error: null;
} | {
    output: null;
    error: string;
};
/**
 * パッケージマネージャーに応じて audit 結果をパース
 */
export declare function parseAuditResult(pm: PackageManager, jsonOutput: string): VulnerabilityItem[];
/**
 * lint-security コマンドハンドラ
 */
export declare function lintSecurityCommand(options: LintSecurityOptions): Promise<number>;
export {};
//# sourceMappingURL=security.d.ts.map