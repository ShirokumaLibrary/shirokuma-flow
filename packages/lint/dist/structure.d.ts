import type { LintStructureConfig, LintStructureReport } from './structure-types.js';
export interface LintStructureParams {
    projectPath: string;
    config: LintStructureConfig;
}
export declare function lintStructure(params: LintStructureParams): LintStructureReport;
//# sourceMappingURL=structure.d.ts.map