/**
 * repo pairs helpers - Shared types and utilities for pairs subcommands
 */
export interface RepoPairsOptions {
    verbose?: boolean;
    private?: string;
    public?: string;
    exclude?: string[];
    tag?: string;
    dryRun?: boolean;
    sourceDir?: string;
}
export interface PairsLogger {
    info: (msg: string) => void;
    error: (msg: string) => void;
    verbose: (msg: string) => void;
    success: (msg: string) => void;
}
export declare function createPairsLogger(isVerbose?: boolean): PairsLogger;
/**
 * Collect local files recursively, filtering by exclude patterns.
 */
export declare function collectLocalFiles(basePath: string, excludePatterns: string[]): Array<{
    path: string;
    isBinary: boolean;
}>;
/**
 * Determine if a file is binary by checking for null bytes in the first 512 bytes.
 */
export declare function isBinaryFile(filePath: string): boolean;
/**
 * Find shirokuma-docs config file in current directory.
 */
export declare function findConfigFile(): string | null;
//# sourceMappingURL=helpers.d.ts.map