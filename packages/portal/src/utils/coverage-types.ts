/**
 * カバレッジ型定義（portal 用軽量版）
 *
 * flow/src/lint/coverage-types.ts から link-docs.ts に必要な定義のみを抽出。
 */

/** severity 型（lint/types.ts からコピー） */
type Severity = "error" | "warning" | "info";

/** 実装ファイルのスキップ理由 */
export interface SkipTestAnnotation {
  reason: string;
  seeReference?: string;
}

/** 実装ファイル情報 */
export interface SourceFile {
  path: string;
  skipTest?: SkipTestAnnotation;
}

/** テストファイル情報 */
export interface TestFile {
  path: string;
  testCount: number;
}

/** ファイル対応規約 */
export interface ConventionMapping {
  source: string;
  test: string;
}

/** 対応状態 */
export type CoverageStatus = "covered" | "skipped" | "missing" | "orphan";

/** ファイル対応結果 */
export interface FileCoverageResult {
  source: string;
  test?: string;
  testCount: number;
  status: CoverageStatus;
  skipReason?: string;
  seeReference?: string;
}

/** 孤立テストファイル */
export interface OrphanTestResult {
  test: string;
  expectedSource: string;
}

/** カバレッジレポート */
export interface CoverageReport {
  results: FileCoverageResult[];
  orphans: OrphanTestResult[];
  summary: {
    totalSources: number;
    coveredCount: number;
    skippedCount: number;
    missingCount: number;
    orphanCount: number;
    coveragePercent: number;
  };
  passed: boolean;
}

/** カバレッジ設定 */
export interface CoverageConfig {
  enabled?: boolean;
  strict?: boolean;
  requireSkipReason?: boolean;
  conventions?: ConventionMapping[];
  exclude?: string[];
  rules?: {
    "missing-test"?: Severity | "off";
    "orphan-test"?: Severity | "off";
    "skip-without-reason"?: Severity | "off";
  };
}

/** デフォルト規約 */
export const defaultConventions: ConventionMapping[] = [
  { source: "lib/**/*.ts", test: "__tests__/lib/**/*.test.ts" },
  { source: "lib/**/*.tsx", test: "__tests__/lib/**/*.test.tsx" },
  { source: "components/**/*.tsx", test: "__tests__/components/**/*.test.tsx" },
  { source: "components/**/*.tsx", test: "__tests__/components/**/*.test.ts" },
  { source: "app/**/actions.ts", test: "__tests__/lib/actions/**/*.test.ts" },
];

/** デフォルト除外パターン */
export const defaultExcludes: string[] = [
  "components/ui/**",
  "lib/generated/**",
  "**/index.ts",
  "**/*.d.ts",
  "**/node_modules/**",
  "**/__tests__/**",
];
