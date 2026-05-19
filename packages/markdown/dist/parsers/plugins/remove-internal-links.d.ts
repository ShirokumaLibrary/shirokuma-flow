import type { Root } from 'mdast';
/**
 * Remark plugin to remove internal markdown links
 *
 * Removes internal links (redundant in combined output):
 * [See documentation](./docs/guide.md) → See documentation
 * [Previous section](../intro.md) → Previous section
 *
 * Preserves external links:
 * [GitHub](https://github.com) → kept as is
 *
 * Token savings: ~10-30 tokens per internal link
 *
 * @example
 * ```typescript
 * import { unified } from 'unified';
 * import remarkParse from 'remark-parse';
 * import remarkStringify from 'remark-stringify';
 * import { remarkRemoveInternalLinks } from './plugins/remove-internal-links.js';
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(remarkRemoveInternalLinks)
 *   .use(remarkStringify);
 *
 * const result = await processor.process(markdown);
 * ```
 */
export declare function remarkRemoveInternalLinks(): (tree: Root) => void;
/**
 * Count internal markdown links without removing them
 * Useful for analysis and reporting
 *
 * @param tree - Markdown AST
 * @returns Number of internal links found
 */
export declare function countInternalLinks(tree: Root): number;
//# sourceMappingURL=remove-internal-links.d.ts.map