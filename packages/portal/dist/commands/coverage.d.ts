/**
 * coverage コマンド - Jest/Istanbul カバレッジレポート可視化
 *
 * Istanbul の coverage-summary.json を解析して視覚的なダッシュボードを生成
 * CI 用の閾値チェック機能もサポート
 */
/**
 * Istanbul coverage-summary.json のメトリクス項目
 */
export interface CoverageMetric {
    total: number;
    covered: number;
    skipped?: number;
    pct: number;
}
/**
 * Istanbul coverage-summary.json のファイルエントリ
 */
export interface IstanbulFileCoverage {
    lines: CoverageMetric;
    statements: CoverageMetric;
    functions: CoverageMetric;
    branches: CoverageMetric;
}
/**
 * Istanbul coverage-summary.json 全体の型
 */
export interface IstanbulCoverageSummary {
    total?: IstanbulFileCoverage;
    [filePath: string]: IstanbulFileCoverage | undefined;
}
/**
 * 解析後のファイルカバレッジ情報
 */
export interface FileCoverage {
    path: string;
    lines: {
        total: number;
        covered: number;
        pct: number;
    };
    statements: {
        total: number;
        covered: number;
        pct: number;
    };
    functions: {
        total: number;
        covered: number;
        pct: number;
    };
    branches: {
        total: number;
        covered: number;
        pct: number;
    };
}
/**
 * 合計カバレッジ情報
 */
export interface TotalCoverage {
    lines: {
        total: number;
        covered: number;
        pct: number;
    };
    statements: {
        total: number;
        covered: number;
        pct: number;
    };
    functions: {
        total: number;
        covered: number;
        pct: number;
    };
    branches: {
        total: number;
        covered: number;
        pct: number;
    };
}
/**
 * 閾値設定
 */
export interface CoverageThresholds {
    lines?: number;
    branches?: number;
    functions?: number;
    statements?: number;
}
/**
 * 閾値チェック結果
 */
export interface CoverageCheckResult {
    passed: boolean;
    failures: string[];
}
/**
 * カバレッジステータス
 */
export type CoverageStatus = "high" | "medium" | "low";
/**
 * コマンドオプション
 */
interface CoverageOptions {
    project: string;
    config: string;
    format?: "html" | "json" | "summary";
    output?: string;
    failUnder?: number;
    verbose?: boolean;
}
/**
 * Istanbul coverage-summary.json をパースしてファイル一覧を取得
 */
export declare function parseIstanbulCoverage(json: IstanbulCoverageSummary): FileCoverage[];
/**
 * ファイル一覧から合計カバレッジを計算
 */
export declare function calculateTotalCoverage(files: FileCoverage[]): TotalCoverage;
/**
 * 閾値をチェック
 */
export declare function checkThresholds(coverage: TotalCoverage, thresholds: CoverageThresholds): CoverageCheckResult;
/**
 * カバレッジ率からステータスを取得
 */
export declare function getCoverageStatus(pct: number): CoverageStatus;
/**
 * カバレッジレポートをフォーマット
 */
export declare function formatCoverageReport(files: FileCoverage[], format: "html" | "json" | "summary"): string;
/**
 * coverage コマンドハンドラ
 */
export declare function coverageCommand(options: CoverageOptions): number;
export {};
//# sourceMappingURL=coverage.d.ts.map