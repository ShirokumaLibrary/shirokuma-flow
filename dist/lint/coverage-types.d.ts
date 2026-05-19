/**
 * Coverage Types - 実装-テスト対応チェック用型定義
 *
 * 規約ベースのファイル対応検出と @skip-test アノテーションサポート
 */
import type { Severity } from "./types.js";
/**
 * 実装ファイルのスキップ理由
 */
export interface SkipTestAnnotation {
    /** 理由 */
    reason: string;
    /** 参照先テスト (@see で指定) */
    seeReference?: string;
}
/**
 * 実装ファイル情報
 */
export interface SourceFile {
    /** ファイルパス (相対) */
    path: string;
    /** @skip-test アノテーション (あれば) */
    skipTest?: SkipTestAnnotation;
}
/**
 * テストファイル情報
 */
export interface TestFile {
    /** ファイルパス (相対) */
    path: string;
    /** テスト数 */
    testCount: number;
}
/**
 * ファイル対応規約
 */
export interface ConventionMapping {
    /** ソースファイルのglobパターン */
    source: string;
    /** テストファイルのglobパターン */
    test: string;
}
/**
 * 対応状態
 */
export type CoverageStatus = "covered" | "skipped" | "missing" | "orphan";
/**
 * ファイル対応結果
 */
export interface FileCoverageResult {
    /** ソースファイルパス */
    source: string;
    /** 対応テストファイルパス (あれば) */
    test?: string;
    /** テスト数 */
    testCount: number;
    /** 対応状態 */
    status: CoverageStatus;
    /** スキップ理由 (skipped の場合) */
    skipReason?: string;
    /** 参照先 (@see) */
    seeReference?: string;
}
/**
 * 孤立テストファイル
 */
export interface OrphanTestResult {
    /** テストファイルパス */
    test: string;
    /** 期待されるソースファイルパス */
    expectedSource: string;
}
/**
 * カバレッジレポート
 */
export interface CoverageReport {
    /** ファイル対応結果 */
    results: FileCoverageResult[];
    /** 孤立テスト */
    orphans: OrphanTestResult[];
    /** サマリー */
    summary: {
        /** ソースファイル数 */
        totalSources: number;
        /** テスト済みファイル数 */
        coveredCount: number;
        /** スキップファイル数 */
        skippedCount: number;
        /** 未テストファイル数 */
        missingCount: number;
        /** 孤立テスト数 */
        orphanCount: number;
        /** カバレッジ率 (covered + skipped) / total * 100 */
        coveragePercent: number;
    };
    /** 合格したかどうか (missing === 0) */
    passed: boolean;
}
/**
 * カバレッジ設定
 */
export interface CoverageConfig {
    /** 有効フラグ */
    enabled?: boolean;
    /** strictモード (missing があれば失敗) */
    strict?: boolean;
    /** @skip-test に理由が必須か */
    requireSkipReason?: boolean;
    /** 規約マッピング */
    conventions?: ConventionMapping[];
    /** 除外パターン */
    exclude?: string[];
    /** ルール設定 */
    rules?: {
        "missing-test"?: Severity | "off";
        "orphan-test"?: Severity | "off";
        "skip-without-reason"?: Severity | "off";
    };
}
/**
 * デフォルト規約
 */
export declare const defaultConventions: ConventionMapping[];
/**
 * デフォルト除外パターン
 */
export declare const defaultExcludes: string[];
//# sourceMappingURL=coverage-types.d.ts.map