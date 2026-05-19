import { Config, ExtractionResult, BatchExtractionResult } from '../parsers/types/config.js';
/**
 * Extractor class - Extracts information from markdown files and creates shirokuma-md compatible files
 */
export declare class Extractor {
    private config;
    constructor(config: Config);
    /**
     * Extract information from a single file
     */
    extract(inputPath: string, documentType: string, outputPath?: string): Promise<ExtractionResult>;
    /**
     * Extract a single field from content
     */
    private extractField;
    /**
     * Apply mapping to a value
     */
    private applyMapping;
    /**
     * Generate frontmatter from extracted fields
     */
    private generateFrontmatter;
    /**
     * Substitute variables in a string (e.g., ${profession} -> warrior)
     */
    private substituteVariables;
    /**
     * Validate extracted data against rules
     */
    private validateExtractedData;
    /**
     * Determine output path based on document type and extracted fields
     */
    private determineOutputPath;
    /**
     * Write extracted content to output file
     */
    writeExtractedFile(result: ExtractionResult, originalContent: string, overwrite?: boolean): Promise<void>;
    /**
     * Batch extract multiple files
     */
    batchExtract(inputDir: string, documentType: string, outputDir?: string, options?: {
        pattern?: string;
        continueOnError?: boolean;
        overwrite?: boolean;
    }): Promise<BatchExtractionResult>;
    /**
     * Get all markdown files in a directory
     */
    private getMarkdownFiles;
    /**
     * Aggregate statistics from batch results
     */
    private aggregateStatistics;
}
//# sourceMappingURL=extractor.d.ts.map