import { visit, SKIP } from 'unist-util-visit';
import type { Root, HTML } from 'mdast';

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
export function remarkRemoveComments() {
  return (tree: Root) => {
    visit(tree, 'html', (node: HTML, index, parent) => {
      // Check if this is an HTML comment
      if (node.value.match(/^<!--[\s\S]*?-->$/)) {
        // Remove HTML comment
        if (parent && typeof index === 'number') {
          parent.children.splice(index, 1);
          return [SKIP, index];
        }
      }
    });
  };
}
