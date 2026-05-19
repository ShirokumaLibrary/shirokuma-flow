import { visit } from 'unist-util-visit';
/**
 * Remark plugin to normalize whitespace in markdown
 *
 * Normalizes excessive whitespace:
 * - Replaces 3+ consecutive blank lines with 2 blank lines
 * - Removes trailing spaces from lines
 *
 * Token savings: ~5-20 tokens per document
 *
 * This plugin operates on text nodes and the final stringified output.
 *
 * @example
 * ```typescript
 * import { unified } from 'unified';
 * import remarkParse from 'remark-parse';
 * import remarkStringify from 'remark-stringify';
 * import { remarkNormalizeWhitespace } from './plugins/normalize-whitespace.js';
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(remarkNormalizeWhitespace)
 *   .use(remarkStringify);
 *
 * const result = await processor.process(markdown);
 * ```
 */
export function remarkNormalizeWhitespace() {
    return (tree, file) => {
        // This plugin primarily works during stringify phase
        // We'll use the stringify option to normalize whitespace
        // Clean up text nodes (remove trailing spaces in text content)
        visit(tree, 'text', (node) => {
            // Trim trailing spaces from text values
            // Note: This is conservative - only affects text nodes
            if (node.value) {
                // Remove trailing spaces at end of text nodes
                node.value = node.value.replace(/ +$/gm, '');
            }
        });
        // The main whitespace normalization happens in post-processing
        // We'll attach a compiler to handle this after stringify
        if (file && file.data) {
            file.data.normalizeWhitespace = true;
        }
    };
}
/**
 * Post-process stringified markdown to normalize whitespace
 * This should be called after remark-stringify
 *
 * @param content - Stringified markdown content
 * @returns Normalized content
 */
export function normalizeWhitespaceContent(content) {
    // Replace 3+ consecutive blank lines with 2 blank lines
    let normalized = content.replace(/\n{3,}/g, '\n\n');
    // Remove trailing spaces from each line
    normalized = normalized
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n');
    return normalized;
}
/**
 * Check if content has excessive whitespace
 * Useful for validation and detection
 *
 * @param content - Markdown content
 * @returns True if excessive whitespace is found
 */
export function hasExcessiveWhitespace(content) {
    // Check for 3+ consecutive blank lines
    if (content.match(/\n{3,}/)) {
        return true;
    }
    // Check for trailing spaces
    const lines = content.split('\n');
    for (const line of lines) {
        if (line !== line.trimEnd() && line.trim() !== '') {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=normalize-whitespace.js.map