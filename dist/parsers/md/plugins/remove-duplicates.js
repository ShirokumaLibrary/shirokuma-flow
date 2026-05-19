import { visit, SKIP } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
/**
 * Remark plugin to remove duplicate paragraphs from markdown
 *
 * Removes repeated paragraph content (common in auto-generated docs):
 * This library provides Markdown processing.
 *
 * ## Features
 * This library provides Markdown processing.  ← Removed
 *
 * Token savings: Varies (50-500 tokens per document for auto-generated content)
 *
 * Warning: Use with caution - legitimate repetition exists in natural writing.
 * Recommended for auto-generated documentation only.
 *
 * @example
 * ```typescript
 * import { unified } from 'unified';
 * import remarkParse from 'remark-parse';
 * import remarkStringify from 'remark-stringify';
 * import { remarkRemoveDuplicates } from './plugins/remove-duplicates.js';
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(remarkRemoveDuplicates)
 *   .use(remarkStringify);
 *
 * const result = await processor.process(markdown);
 * ```
 */
export function remarkRemoveDuplicates() {
    return (tree) => {
        const seen = new Set();
        visit(tree, 'paragraph', (node, index, parent) => {
            const text = toString(node).trim();
            if (text && seen.has(text)) {
                // Remove duplicate paragraph
                if (parent && typeof index === 'number') {
                    parent.children.splice(index, 1);
                    return [SKIP, index];
                }
            }
            if (text) {
                seen.add(text);
            }
        });
    };
}
/**
 * Count duplicate paragraphs without removing them
 * Useful for analysis and reporting
 *
 * @param tree - Markdown AST
 * @returns Number of duplicate paragraphs found
 */
export function countDuplicates(tree) {
    const seen = new Map();
    let duplicates = 0;
    visit(tree, 'paragraph', (node) => {
        const text = toString(node).trim();
        if (text) {
            const count = seen.get(text) || 0;
            seen.set(text, count + 1);
            if (count > 0) {
                duplicates++;
            }
        }
    });
    return duplicates;
}
//# sourceMappingURL=remove-duplicates.js.map