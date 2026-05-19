import type { Config } from '../../parsers/md/types/config.js';
import type { AnalysisResult } from '../../parsers/md/types/validation.js';
/**
 * Document analyzer
 * Analyzes document structure and dependencies
 */
export declare class Analyzer {
    private config;
    constructor(config: Config);
    /**
     * Analyzes document structure and dependencies
     *
     * Performs comprehensive analysis including:
     * - Dependency graph extraction (frontmatter, wiki-links, markdown links)
     * - Circular dependency detection
     * - Orphan file detection
     * - File metrics (lines, tokens, headings)
     * - Split suggestions for large files (optional)
     *
     * @param sourceDir - Source directory containing markdown files
     * @param options - Analysis options (includeMetrics, includeSplitSuggestions)
     * @returns Analysis result with dependencies, metrics, and suggestions
     *
     * @example
     * ```typescript
     * const analyzer = new Analyzer(config);
     * const result = await analyzer.analyze('./docs', { includeMetrics: true });
     * console.log(`Found ${result.dependencies.length} dependencies`);
     * console.log(`Detected ${result.cycles.length} circular dependencies`);
     * ```
     */
    analyze(sourceDir: string, options?: {
        includeMetrics?: boolean;
        includeSplitSuggestions?: boolean;
    }): Promise<AnalysisResult>;
    private extractDependencies;
    private detectCycles;
    private detectOrphans;
    private calculateMostReferenced;
    private buildGraph;
    private calculateFileMetrics;
    private generateSplitSuggestions;
    private extractSectionContent;
    generateGraph(result: AnalysisResult): string;
}
//# sourceMappingURL=index.d.ts.map