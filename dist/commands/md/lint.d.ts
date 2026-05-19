interface LintOptions {
    config?: string;
    fix?: boolean;
    verbose?: boolean;
    suggestFixes?: boolean;
    format?: 'markdown' | 'json';
    output?: string;
}
export declare function lintCommand(options: LintOptions): Promise<number>;
export {};
//# sourceMappingURL=lint.d.ts.map