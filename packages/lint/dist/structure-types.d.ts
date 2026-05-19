export type StructureRule = 'dir-required' | 'file-required' | 'dir-recommended';
export type StructureStatus = 'pass' | 'error' | 'warning';
export interface StructureCheck {
    rule: StructureRule;
    status: StructureStatus;
    target: string;
    message?: string;
}
export interface LintStructureConfig {
    /** 必須ディレクトリ（欠けていれば error）。project root からの相対パス。 */
    dirRequired?: string[];
    /** 必須ファイル（欠けていれば error）。 */
    fileRequired?: string[];
    /** 推奨ディレクトリ（欠けていれば warning）。 */
    dirRecommended?: string[];
}
export interface LintStructureReport {
    checks: StructureCheck[];
    summary: {
        totalChecks: number;
        errorCount: number;
        warningCount: number;
        passCount: number;
    };
    passed: boolean;
}
//# sourceMappingURL=structure-types.d.ts.map