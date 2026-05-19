import type { Root } from 'mdast';
/**
 * Remark plugin to strip section-meta HTML comments from markdown
 *
 * Removes section-meta blocks used for development/build metadata:
 * <!-- section-meta
 * priority: high
 * tokens: 450
 * -->
 *
 * This plugin uses AST-based processing for safe removal.
 *
 * @example
 * ```typescript
 * import { unified } from 'unified';
 * import remarkParse from 'remark-parse';
 * import remarkStringify from 'remark-stringify';
 * import { remarkStripSectionMeta } from './plugins/strip-section-meta.js';
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(remarkStripSectionMeta)
 *   .use(remarkStringify);
 *
 * const result = await processor.process(markdown);
 * ```
 */
export declare function remarkStripSectionMeta(): (tree: Root) => void;
/**
 * Check if markdown contains section-meta comments
 * Useful for validation and detection
 *
 * @param tree - Markdown AST
 * @returns True if section-meta comments are found
 */
export declare function hasSectionMeta(tree: Root): boolean;
//# sourceMappingURL=strip-section-meta.d.ts.map