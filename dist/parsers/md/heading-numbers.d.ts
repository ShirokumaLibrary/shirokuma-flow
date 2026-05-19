/**
 * Heading number removal utilities
 * Strips numbering from markdown headings for LLM token optimization
 */
/**
 * Strip numbering from markdown headings
 * Preserves heading structure and numbering inside code blocks
 *
 * @example
 * Input:  ## 1. Introduction
 * Output: ## Introduction
 *
 * Input:  ### 2.1. Getting Started
 * Output: ### Getting Started
 *
 * @param markdown - Markdown content
 * @returns Markdown with heading numbers removed
 */
export declare function stripHeadingNumbers(markdown: string): string;
/**
 * Detect if markdown contains numbered headings
 * Useful for validation and reporting
 *
 * @param markdown - Markdown content
 * @returns True if numbered headings are found
 */
export declare function hasNumberedHeadings(markdown: string): boolean;
/**
 * Extract numbered headings from markdown
 * Returns array of heading info for analysis
 *
 * @param markdown - Markdown content
 * @returns Array of numbered heading info
 */
export interface NumberedHeading {
    lineNumber: number;
    level: number;
    number: string;
    title: string;
    raw: string;
}
export declare function extractNumberedHeadings(markdown: string): NumberedHeading[];
//# sourceMappingURL=heading-numbers.d.ts.map