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
export declare const defaultConventions: readonly [{
    readonly source: "src/**/*.ts";
    readonly test: "tests/**/*.test.ts";
}, {
    readonly source: "src/**/*.tsx";
    readonly test: "tests/**/*.test.tsx";
}];
export declare const defaultExcludes: readonly ["**/index.ts", "**/*.d.ts", "**/node_modules/**", "**/dist/**", "**/tests/**", "**/__tests__/**"];
//# sourceMappingURL=coverage-types.d.ts.map