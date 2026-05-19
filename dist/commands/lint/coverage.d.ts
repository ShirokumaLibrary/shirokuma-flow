/**
 * lint-coverage コマンド - 実装-テスト対応チェック
 *
 * 規約ベースでソースファイルとテストファイルの対応を検証
 * @skip-test アノテーションによる例外指定をサポート
 */
import type { CoverageReport } from "../../lint/coverage-types.js";
/**
 * コマンドオプション
 */
interface LintCoverageOptions {
    project: string;
    config: string;
    format?: "terminal" | "json" | "summary";
    output?: string;
    strict?: boolean;
    verbose?: boolean;
}
/**
 * lint-coverage コマンドハンドラ
 */
export declare function lintCoverageCommand(options: LintCoverageOptions): number;
/**
 * Programmatic interface for running lint-coverage
 * Used by portal command to generate coverage.json
 */
export interface RunLintCoverageOptions {
    projectPath: string;
    configPath?: string;
}
export declare function runLintCoverage(options: RunLintCoverageOptions): CoverageReport;
export {};
//# sourceMappingURL=coverage.d.ts.map