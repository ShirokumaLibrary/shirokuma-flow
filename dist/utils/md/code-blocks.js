/**
 * Code block detection and handling utilities
 * Extracted to eliminate duplicated logic across Linter, Parser, and Validator
 */
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
export class CodeBlockTracker {
    inCodeBlock = false;
    /**
     * Process a line and update code block state
     * @param line - Line to process
     */
    processLine(line) {
        if (line.trim().startsWith('```')) {
            this.inCodeBlock = !this.inCodeBlock;
        }
    }
    /**
     * Check if currently inside a code block
     * @returns True if inside code block
     */
    isInCodeBlock() {
        return this.inCodeBlock;
    }
    /**
     * Reset tracker state
     */
    reset() {
        this.inCodeBlock = false;
    }
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
export function extractCodeBlocks(content) {
    const lines = content.split('\n');
    const blocks = [];
    let inCodeBlock = false;
    let currentBlock = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line && line !== '')
            continue;
        const lineNum = i + 1;
        if (line.trim().startsWith('```')) {
            if (!inCodeBlock) {
                // Start of code block
                const language = line.trim().substring(3).trim();
                currentBlock = {
                    startLine: lineNum,
                    language: language || undefined,
                    content: '',
                };
                inCodeBlock = true;
            }
            else {
                // End of code block
                if (currentBlock) {
                    currentBlock.endLine = lineNum;
                    blocks.push(currentBlock);
                }
                currentBlock = null;
                inCodeBlock = false;
            }
        }
        else if (inCodeBlock && currentBlock) {
            // Accumulate code block content
            currentBlock.content += (currentBlock.content ? '\n' : '') + line;
        }
    }
    return blocks;
}
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
export function isLineInCodeBlock(lineNumber, codeBlocks) {
    return codeBlocks.some(block => lineNumber >= block.startLine && lineNumber <= block.endLine);
}
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
export function extractAndReplace(content) {
    const blocks = [];
    const placeholder = '___CODE_BLOCK_PLACEHOLDER___';
    const regex = /```[\s\S]*?```/g;
    const modified = content.replace(regex, (match) => {
        blocks.push(match);
        return `${placeholder}${blocks.length - 1}${placeholder}`;
    });
    return { content: modified, blocks, placeholder };
}
/**
 * Restore code blocks from placeholders
 *
 * @param content - Content with placeholders
 * @param blocks - Array of original code blocks
 * @param placeholder - Placeholder string used
 * @returns Content with restored code blocks
 */
export function restoreCodeBlocks(content, blocks, placeholder = '___CODE_BLOCK_PLACEHOLDER___') {
    let restored = content;
    blocks.forEach((block, index) => {
        const placeholderPattern = `${placeholder}${index}${placeholder}`;
        restored = restored.replace(placeholderPattern, block);
    });
    return restored;
}
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
export function processExcludingCodeBlocks(content, transform) {
    const { content: safe, blocks, placeholder } = extractAndReplace(content);
    const transformed = transform(safe);
    return restoreCodeBlocks(transformed, blocks, placeholder);
}
//# sourceMappingURL=code-blocks.js.map