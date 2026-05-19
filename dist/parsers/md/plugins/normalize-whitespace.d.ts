import type { Root } from 'mdast';
import type { VFile } from 'vfile';
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
export declare function remarkNormalizeWhitespace(): (tree: Root, file?: VFile) => void;
/**
 * Post-process stringified markdown to normalize whitespace
 * This should be called after remark-stringify
 *
 * @param content - Stringified markdown content
 * @returns Normalized content
 */
export declare function normalizeWhitespaceContent(content: string): string;
/**
 * Check if content has excessive whitespace
 * Useful for validation and detection
 *
 * @param content - Markdown content
 * @returns True if excessive whitespace is found
 */
export declare function hasExcessiveWhitespace(content: string): boolean;
//# sourceMappingURL=normalize-whitespace.d.ts.map