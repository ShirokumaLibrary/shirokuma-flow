import type { LintCodeConfig, LintCodeReport } from './code-types.js';
export interface LintCodeParams {
    projectPath: string;
    config: LintCodeConfig;
}
export declare function lintCode(params: LintCodeParams): LintCodeReport;
//# sourceMappingURL=code.d.ts.map