import { visit, SKIP } from 'unist-util-visit';
import type { Root, HTML } from 'mdast';

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
export function remarkStripSectionMeta() {
  return (tree: Root) => {
    visit(tree, 'html', (node: HTML, index, parent) => {
      // Check if this is a section-meta comment
      // Match both single-line and multi-line variants
      if (
        node.value.match(/^<!--\s*section-meta[\s\S]*?-->$/) ||
        node.value.trim() === '<!-- section-meta' ||
        node.value.trim() === '-->'
      ) {
        // Remove section-meta comment
        if (parent && typeof index === 'number') {
          parent.children.splice(index, 1);
          return [SKIP, index];
        }
      }
    });
  };
}

/**
 * Check if markdown contains section-meta comments
 * Useful for validation and detection
 *
 * @param tree - Markdown AST
 * @returns True if section-meta comments are found
 */
export function hasSectionMeta(tree: Root): boolean {
  let found = false;

  visit(tree, 'html', (node: HTML) => {
    if (node.value.match(/<!--\s*section-meta/)) {
      found = true;
      return false; // Stop visiting
    }
  });

  return found;
}
