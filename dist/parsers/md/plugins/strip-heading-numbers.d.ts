import type { Root } from 'mdast';
/**
 * Remark plugin to strip numbering from markdown headings
 *
 * Removes numbers from headings for better flexibility and token efficiency:
 * ## 1. Introduction → ## Introduction
 * ### 2.1. Getting Started → ### Getting Started
 *
 * This plugin uses AST-based processing, never touching code blocks.
 *
 * @example
 * ```typescript
 * import { unified } from 'unified';
 * import remarkParse from 'remark-parse';
 * import remarkStringify from 'remark-stringify';
 * import { remarkStripHeadingNumbers } from './plugins/strip-heading-numbers.js';
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(remarkStripHeadingNumbers)
 *   .use(remarkStringify);
 *
 * const result = await processor.process(markdown);
 * ```
 */
export declare function remarkStripHeadingNumbers(): (tree: Root) => void;
/**
 * Check if markdown contains numbered headings
 * Useful for validation and detection
 *
 * @param tree - Markdown AST
 * @returns True if numbered headings are found
 */
export declare function hasNumberedHeadings(tree: Root): boolean;
//# sourceMappingURL=strip-heading-numbers.d.ts.map