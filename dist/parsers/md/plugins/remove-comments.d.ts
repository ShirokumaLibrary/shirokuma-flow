import type { Root } from 'mdast';
/**
 * Remark plugin to remove HTML comments from markdown
 *
 * Removes development comments and TODOs from LLM output:
 * <!-- TODO: Update this section -->
 * <!-- Author: John Doe, 2024-01-15 -->
 *
 * Token savings: ~10-50 tokens per document
 *
 * @example
 * ```typescript
 * import { unified } from 'unified';
 * import remarkParse from 'remark-parse';
 * import remarkStringify from 'remark-stringify';
 * import { remarkRemoveComments } from './plugins/remove-comments.js';
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(remarkRemoveComments)
 *   .use(remarkStringify);
 *
 * const result = await processor.process(markdown);
 * ```
 */
export declare function remarkRemoveComments(): (tree: Root) => void;
//# sourceMappingURL=remove-comments.d.ts.map