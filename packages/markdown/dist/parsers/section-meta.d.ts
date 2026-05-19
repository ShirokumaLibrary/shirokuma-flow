/**
 * Section metadata interface
 */
export interface SectionMeta {
    /** Line number where section-meta starts */
    lineNumber: number;
    /** Raw HTML comment content */
    raw: string;
    /** Parsed YAML content */
    parsed: Record<string, unknown>;
}
/**
 * Result of section-meta extraction
 */
export interface SectionMetaExtractionResult {
    /** Extracted section metadata */
    sectionMeta: SectionMeta[];
    /** Markdown with section-meta removed */
    cleaned: string;
}
/**
 * Extract all section-meta from markdown content
 * @param markdown - Markdown content
 * @returns Extraction result with metadata and cleaned content
 */
export declare function extractSectionMeta(markdown: string): SectionMetaExtractionResult;
/**
 * Strip all section-meta from markdown content
 * Preserves section-meta inside code blocks and inline code
 * @param markdown - Markdown content
 * @returns Markdown with section-meta removed
 */
export declare function stripSectionMeta(markdown: string): string;
/**
 * Validate section-meta YAML syntax
 * @param markdown - Markdown content
 * @returns Array of validation errors
 */
export declare function validateSectionMeta(markdown: string): Array<{
    lineNumber: number;
    error: string;
}>;
/**
 * Get section-meta for a specific heading
 * @param markdown - Markdown content
 * @param headingText - Heading text to search for
 * @returns Section metadata or null if not found
 */
export declare function getSectionMeta(markdown: string, headingText: string): Record<string, unknown> | null;
//# sourceMappingURL=section-meta.d.ts.map