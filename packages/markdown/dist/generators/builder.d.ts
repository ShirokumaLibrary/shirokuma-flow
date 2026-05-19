import type { Config, BuildResult } from '../parsers/types/config.js';
/**
 * Document builder
 * Combines multiple Markdown files into a single document
 */
export declare class Builder {
    private config;
    constructor(config: Config);
    /**
     * Builds combined markdown document from source directory
     *
     * Collects all markdown files matching include/exclude patterns, applies
     * build-time optimizations (frontmatter stripping, token optimization),
     * and combines them into a single output file.
     *
     * @param sourceDir - Source directory containing markdown files
     * @param outputPath - Optional output path (uses config default if not specified)
     * @returns Build result with file count, token count, and execution time
     * @throws {Error} If no files found or build fails
     *
     * @example
     * ```typescript
     * const builder = new Builder(config);
     * const result = await builder.build('./docs', './dist/output.md');
     * console.log(`Built ${result.fileCount} files in ${result.buildTime}ms`);
     * ```
     */
    build(sourceDir: string, outputPath?: string): Promise<BuildResult>;
    private collectFiles;
    private parseDocuments;
    private parseSections;
    private sortDocuments;
    private groupByPattern;
    /**
     * Topological sort of documents based on dependencies
     * Uses Kahn's algorithm with stable ordering by layer/category/title
     */
    private topologicalSort;
    /**
     * Build path map for quick document lookup
     */
    private buildPathMap;
    /**
     * Build dependency graph with in-degrees and dependents
     */
    private buildDependencyGraph;
    /**
     * Sort documents by metadata (layer, category, title)
     */
    private sortByMetadata;
    /**
     * Kahn's algorithm for topological sorting
     */
    private kahnsAlgorithm;
    /**
     * Handle circular dependencies by appending remaining documents
     */
    private handleCircularDependencies;
    private getSortIndex;
    private generateTOC;
    private slugify;
    private combineDocuments;
    /**
     * Apply build-time optimizations (non-destructive to source files)
     */
    /**
     * Apply build optimizations using unified remark pipeline
     * Migrated from regex-based to AST-based processing for safety
     */
    private applyBuildOptimizations;
    /**
     * Watches source directory for changes and rebuilds automatically
     *
     * Starts a file watcher that monitors changes to markdown files and triggers
     * automatic rebuilds with debouncing. Runs indefinitely until interrupted.
     *
     * @param sourceDir - Source directory to watch
     * @param outputPath - Output path for rebuilt files
     * @returns Promise that never resolves (runs until process exit)
     * @throws {Error} If watcher setup fails (watcher is cleaned up on error)
     *
     * @example
     * ```typescript
     * const builder = new Builder(config);
     * await builder.watch('./docs', './dist/output.md');
     * // Press Ctrl+C to stop watching
     * ```
     */
    watch(sourceDir: string, outputPath: string): Promise<never>;
}
//# sourceMappingURL=builder.d.ts.map