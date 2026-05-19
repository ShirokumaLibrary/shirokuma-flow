import { glob } from 'glob';
import * as path from 'path';
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
export class FileCollector {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Collect all markdown files matching configuration patterns
     *
     * @param sourceDir - Base directory to search in
     * @param options - Override options
     * @returns Array of absolute file paths
     */
    async collect(sourceDir, options = {}) {
        const includePatterns = options.includePatterns || this.config.build.include;
        const excludePatterns = options.excludePatterns || this.config.build.exclude;
        const patterns = includePatterns.map((p) => path.join(sourceDir, p));
        const exclude = excludePatterns.map((p) => path.join(sourceDir, p));
        const allFiles = [];
        const seen = new Set();
        for (const pattern of patterns) {
            const matches = await glob(pattern, {
                ignore: exclude,
                nodir: true,
                ...options.globOptions,
            });
            // Deduplicate files
            for (const file of matches) {
                if (!seen.has(file)) {
                    seen.add(file);
                    allFiles.push(file);
                }
            }
        }
        return allFiles;
    }
    /**
     * Collect files with custom filter function
     *
     * @param sourceDir - Base directory
     * @param filterFn - Custom filter function
     * @param options - Collection options
     * @returns Filtered file paths
     */
    async collectFiltered(sourceDir, filterFn, options = {}) {
        const allFiles = await this.collect(sourceDir, options);
        const filtered = [];
        for (const file of allFiles) {
            const shouldInclude = await filterFn(file);
            if (shouldInclude) {
                filtered.push(file);
            }
        }
        return filtered;
    }
    /**
     * Get relative paths from source directory
     *
     * @param sourceDir - Base directory
     * @param options - Collection options
     * @returns Array of relative file paths
     */
    async collectRelative(sourceDir, options = {}) {
        const absolutePaths = await this.collect(sourceDir, options);
        return absolutePaths.map((file) => path.relative(sourceDir, file));
    }
    /**
     * Count total files matching patterns
     *
     * @param sourceDir - Base directory
     * @param options - Collection options
     * @returns Number of files
     */
    async count(sourceDir, options = {}) {
        const files = await this.collect(sourceDir, options);
        return files.length;
    }
}
/**
 * Helper function to create FileCollector instance
 *
 * @param config - Configuration object
 * @returns FileCollector instance
 */
export function createFileCollector(config) {
    return new FileCollector(config);
}
//# sourceMappingURL=file-collector.js.map