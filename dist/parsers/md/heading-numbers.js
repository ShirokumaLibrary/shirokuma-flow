/**
 * Heading number removal utilities
 * Strips numbering from markdown headings for LLM token optimization
 */
import { REGEX_PATTERNS } from '../../utils/md/constants.js';
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
export function stripHeadingNumbers(markdown) {
    // Step 1: Extract code blocks and replace with placeholders
    const codeBlocks = [];
    const codeBlockPlaceholder = '___CODE_BLOCK_PLACEHOLDER___';
    let withPlaceholders = markdown.replace(/```[\s\S]*?```/g, (match) => {
        codeBlocks.push(match);
        return `${codeBlockPlaceholder}${codeBlocks.length - 1}${codeBlockPlaceholder}`;
    });
    // Step 2: Remove numbers from headings
    // Pattern matches: ## 1. Title, ### 2.1. Subtitle, etc.
    // Captures: (heading markers) (numbers) (rest of title)
    withPlaceholders = withPlaceholders.replace(/^(#{1,6}\s+)\d+(\.\d+)*\.\s+(.+)$/gm, '$1$3' // Keep heading markers and title, remove numbers
    );
    // Step 3: Restore code blocks
    let restored = withPlaceholders;
    codeBlocks.forEach((block, index) => {
        const placeholder = `${codeBlockPlaceholder}${index}${codeBlockPlaceholder}`;
        restored = restored.replace(placeholder, block);
    });
    return restored;
}
/**
 * Detect if markdown contains numbered headings
 * Useful for validation and reporting
 *
 * @param markdown - Markdown content
 * @returns True if numbered headings are found
 */
export function hasNumberedHeadings(markdown) {
    const lines = markdown.split('\n');
    let inCodeBlock = false;
    for (const line of lines) {
        // Track code blocks
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }
        // Skip code block content
        if (inCodeBlock) {
            continue;
        }
        // Check for numbered headings
        if (line.match(REGEX_PATTERNS.NUMBERED_HEADING)) {
            return true;
        }
    }
    return false;
}
export function extractNumberedHeadings(markdown) {
    const lines = markdown.split('\n');
    const headings = [];
    let inCodeBlock = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Track code blocks
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }
        // Skip code block content
        if (inCodeBlock) {
            continue;
        }
        // Match numbered headings
        const match = line.match(/^(#{1,6})\s+(\d+(?:\.\d+)*)\.\s+(.+)$/);
        if (match && match[1] && match[2] && match[3]) {
            headings.push({
                lineNumber: i + 1,
                level: match[1].length,
                number: match[2],
                title: match[3],
                raw: line,
            });
        }
    }
    return headings;
}
//# sourceMappingURL=heading-numbers.js.map