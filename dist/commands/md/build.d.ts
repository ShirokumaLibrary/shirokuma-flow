interface BuildOptions {
    config?: string;
    output?: string;
    include?: string;
    exclude?: string;
    verbose?: boolean;
    watch?: boolean;
}
export declare function buildCommand(options: BuildOptions): Promise<number>;
export {};
//# sourceMappingURL=build.d.ts.map