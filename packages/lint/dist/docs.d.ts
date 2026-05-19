import type { LintDocsConfig, LintDocsReport } from './docs-types.js';
export interface LintDocsParams {
    projectPath: string;
    config: LintDocsConfig;
}
export declare function lintDocs(params: LintDocsParams): LintDocsReport;
//# sourceMappingURL=docs.d.ts.map