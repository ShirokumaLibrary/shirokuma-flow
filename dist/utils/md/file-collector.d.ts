import type { Config } from '../../parsers/md/types/config.js';
/**
 * Options for file collection
 */
export interface FileCollectionOptions {
    /**
     * Override include patterns from config
     */
    includePatterns?: string[];
    /**
     * Override exclude patterns from config
     */
    excludePatterns?: string[];
    /**
     * Additional glob options
     */
    globOptions?: {
        nodir?: boolean;
        dot?: boolean;
        absolute?: boolean;
    };
}
/**
 * Utility for collecting markdown files based on configuration
 *
 * Eliminates duplicated file collection logic across Builder, Validator, and Linter.
 *
 * @example
 * ```typescript
 * const collector = new FileCollector(config);
 * const files = await collector.collect(sourceDir);
 * ```
 */
export declare class FileCollector {
    private config;
    constructor(config: Config);
    /**
     * Collect all markdown files matching configuration patterns
     *
     * @param sourceDir - Base directory to search in
     * @param options - Override options
     * @returns Array of absolute file paths
     */
    collect(sourceDir: string, options?: FileCollectionOptions): Promise<string[]>;
    /**
     * Collect files with custom filter function
     *
     * @param sourceDir - Base directory
     * @param filterFn - Custom filter function
     * @param options - Collection options
     * @returns Filtered file paths
     */
    collectFiltered(sourceDir: string, filterFn: (filePath: string) => boolean | Promise<boolean>, options?: FileCollectionOptions): Promise<string[]>;
    /**
     * Get relative paths from source directory
     *
     * @param sourceDir - Base directory
     * @param options - Collection options
     * @returns Array of relative file paths
     */
    collectRelative(sourceDir: string, options?: FileCollectionOptions): Promise<string[]>;
    /**
     * Count total files matching patterns
     *
     * @param sourceDir - Base directory
     * @param options - Collection options
     * @returns Number of files
     */
    count(sourceDir: string, options?: FileCollectionOptions): Promise<number>;
}
/**
 * Helper function to create FileCollector instance
 *
 * @param config - Configuration object
 * @returns FileCollector instance
 */
export declare function createFileCollector(config: Config): FileCollector;
//# sourceMappingURL=file-collector.d.ts.map