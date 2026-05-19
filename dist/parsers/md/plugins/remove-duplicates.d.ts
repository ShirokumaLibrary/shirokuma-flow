import type { Root } from 'mdast';
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
export declare function remarkRemoveDuplicates(): (tree: Root) => void;
/**
 * Count duplicate paragraphs without removing them
 * Useful for analysis and reporting
 *
 * @param tree - Markdown AST
 * @returns Number of duplicate paragraphs found
 */
export declare function countDuplicates(tree: Root): number;
//# sourceMappingURL=remove-duplicates.d.ts.map