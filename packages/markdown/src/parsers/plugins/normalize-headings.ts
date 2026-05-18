import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import type { Heading, Root } from 'mdast';

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
export function remarkNormalizeHeadings(
  options: NormalizeHeadingsOptions = {}
) {
  const separator = options.separator || ' / ';

  return (tree: Root) => {
    const headingStack: string[] = [];

    visit(tree, 'heading', (node: Heading) => {
      const level = node.depth;
      const text = toString(node);

      // Update stack for current level
      headingStack[level - 1] = text;
      // Clear deeper levels
      headingStack.splice(level);

      // Build hierarchical text (filter out undefined slots from skipped levels)
      const hierarchy = headingStack.slice(0, level).filter(x => x !== undefined).join(separator);

      // Replace heading text with hierarchical version
      node.children = [{ type: 'text', value: hierarchy }];
    });
  };
}
