export interface SkipTestAnnotation {
  reason: string;
  seeReference?: string;
}

export interface ConventionMapping {
  source: string;
  test: string;
}

export type CoverageStatus = 'covered' | 'skipped' | 'missing';

export interface FileCoverageResult {
  source: string;
  test?: string;
  testCount: number;
  status: CoverageStatus;
  skipReason?: string;
  seeReference?: string;
}

export interface OrphanTestResult {
  test: string;
  expectedSource: string;
}

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

export interface CoverageConfig {
  conventions?: ConventionMapping[];
  exclude?: string[];
}

// consumer が convention を設定しない場合に使われる汎用ペア。pnpm workspace /
// TS monorepo 前提（source=src 配下、test=tests 配下）。Next.js 等の __tests__
// レイアウトは consumer 側で convention を上書きする。
export const defaultConventions = [
  { source: 'src/**/*.ts', test: 'tests/**/*.test.ts' },
  { source: 'src/**/*.tsx', test: 'tests/**/*.test.tsx' },
] as const satisfies readonly ConventionMapping[];

export const defaultExcludes = [
  '**/index.ts',
  '**/*.d.ts',
  '**/node_modules/**',
  '**/dist/**',
  '**/tests/**',
  '**/__tests__/**',
] as const satisfies readonly string[];
