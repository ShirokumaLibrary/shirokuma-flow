import type { Root } from 'mdast';
/**
 * Options for hierarchical heading normalization
 */
export interface NormalizeHeadingsOptions {
    /**
     * Separator between heading levels
     * @default " / "
     */
    separator?: string;
}
/**
 * Remark plugin to normalize headings hierarchically for RAG systems
 *
 * Converts flat headings into hierarchical context-aware headings:
 * ## Configuration
 * ### Consumer Settings
 * #### auto_offset_reset
 *
 * Becomes:
 * ## Configuration
 * ### Configuration / Consumer Settings
 * #### Configuration / Consumer Settings / auto_offset_reset
 *
 * This preserves context when documents are chunked for RAG retrieval.
 *
 * @example
 * ```typescript
 * import { unified } from 'unified';
 * import remarkParse from 'remark-parse';
 * import remarkStringify from 'remark-stringify';
 * import { remarkNormalizeHeadings } from './plugins/normalize-headings.js';
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(remarkNormalizeHeadings, { separator: ' / ' })
 *   .use(remarkStringify);
 *
 * const result = await processor.process(markdown);
 * ```
 */
export declare function remarkNormalizeHeadings(options?: NormalizeHeadingsOptions): (tree: Root) => void;
//# sourceMappingURL=normalize-headings.d.ts.map