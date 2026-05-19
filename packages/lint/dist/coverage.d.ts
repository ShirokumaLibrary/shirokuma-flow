import type { CoverageConfig, CoverageReport, SkipTestAnnotation } from './coverage-types.js';
export interface LintCoverageParams {
    projectPath: string;
    config?: CoverageConfig;
}
export declare function lintCoverage(params: LintCoverageParams): CoverageReport;
export declare function extractSkipTest(content: string): SkipTestAnnotation | undefined;
//# sourceMappingURL=coverage.d.ts.map