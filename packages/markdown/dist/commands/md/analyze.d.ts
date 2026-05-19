interface AnalyzeOptions {
    config?: string;
    graph?: boolean;
    output?: string;
    verbose?: boolean;
    metrics?: boolean;
    suggest?: boolean;
}
export declare function analyzeCommand(options: AnalyzeOptions): Promise<number>;
export {};
//# sourceMappingURL=analyze.d.ts.map