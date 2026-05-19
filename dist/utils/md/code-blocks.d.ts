/**
 * Code block detection and handling utilities
 * Extracted to eliminate duplicated logic across Linter, Parser, and Validator
 */
/**
 * Represents a code block's position in content
 */
export interface CodeBlock {
    /**
     * Start line number (1-based)
     */
    startLine: number;
    /**
     * End line number (1-based)
     */
    endLine: number;
    /**
     * Language identifier (e.g., 'typescript', 'mermaid')
     */
    language?: string;
    /**
     * Code block content (excluding fences)
     */
    content: string;
}
/**
 * Simple line-by-line code block tracker
 * Use this for processing content line-by-line
 *
 * @example
 * ```typescript
 * const tracker = new CodeBlockTracker();
 * for (const line of lines) {
 *   tracker.processLine(line);
 *   if (!tracker.isInCodeBlock()) {
 *     // Process non-code-block content
 *   }
 * }
 * ```
 */
export declare class CodeBlockTracker {
    private inCodeBlock;
    /**
     * Process a line and update code block state
     * @param line - Line to process
     */
    processLine(line: string): void;
    /**
     * Check if currently inside a code block
     * @returns True if inside code block
     */
    isInCodeBlock(): boolean;
    /**
     * Reset tracker state
     */
    reset(): void;
}
/**
 * Extract all code blocks from markdown content
 * Returns detailed information about each code block
 *
 * @param content - Markdown content
 * @returns Array of code blocks with positions and metadata
 *
 * @example
 * ```typescript
 * const blocks = extractCodeBlocks(content);
 * for (const block of blocks) {
 *   console.log(`Code block at lines ${block.startLine}-${block.endLine}`);
 *   console.log(`Language: ${block.language || 'none'}`);
 * }
 * ```
 */
export declare function extractCodeBlocks(content: string): CodeBlock[];
/**
 * Check if a specific line number is inside a code block
 *
 * @param lineNumber - Line number to check (1-based)
 * @param codeBlocks - Array of code blocks
 * @returns True if line is inside a code block
 *
 * @example
 * ```typescript
 * const blocks = extractCodeBlocks(content);
 * if (isLineInCodeBlock(42, blocks)) {
 *   console.log('Line 42 is inside a code block');
 * }
 * ```
 */
export declare function isLineInCodeBlock(lineNumber: number, codeBlocks: CodeBlock[]): boolean;
/**
 * Extract code blocks and replace them with placeholders
 * Useful for safe regex operations on markdown content
 *
 * @param content - Markdown content
 * @returns Object with modified content and extracted blocks
 *
 * @example
 * ```typescript
 * const { content: safe, blocks } = extractAndReplace(markdown);
 * // Perform regex operations on 'safe' content
 * const modified = safe.replace(/pattern/g, 'replacement');
 * // Restore code blocks
 * const final = restoreCodeBlocks(modified, blocks);
 * ```
 */
export declare function extractAndReplace(content: string): {
    content: string;
    blocks: string[];
    placeholder: string;
};
/**
 * Restore code blocks from placeholders
 *
 * @param content - Content with placeholders
 * @param blocks - Array of original code blocks
 * @param placeholder - Placeholder string used
 * @returns Content with restored code blocks
 */
export declare function restoreCodeBlocks(content: string, blocks: string[], placeholder?: string): string;
/**
 * Process content with a transformation function, excluding code blocks
 *
 * @param content - Markdown content
 * @param transform - Transformation function to apply
 * @returns Transformed content with code blocks preserved
 *
 * @example
 * ```typescript
 * const result = processExcludingCodeBlocks(content, (text) => {
 *   return text.replace(/pattern/g, 'replacement');
 * });
 * ```
 */
export declare function processExcludingCodeBlocks(content: string, transform: (content: string) => string): string;
//# sourceMappingURL=code-blocks.d.ts.map