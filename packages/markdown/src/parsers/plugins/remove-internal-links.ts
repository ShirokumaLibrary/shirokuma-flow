import { visit, SKIP } from 'unist-util-visit';
import type { Root, Link } from 'mdast';

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
export function remarkRemoveInternalLinks() {
  return (tree: Root) => {
    visit(tree, 'link', (node: Link, index, parent) => {
      const url = node.url;

      // Check if this is an internal markdown link
      // Patterns: ./file.md, ../path/file.md
      const isInternalMdLink =
        url.match(/^\.\/[^\)]+\.md/) ||
        url.match(/^(?:\.\.\/)+[^\)]+\.md/);

      if (isInternalMdLink && parent && typeof index === 'number') {
        // Replace link node with just its text children
        // This preserves the link text but removes the link itself
        parent.children.splice(index, 1, ...node.children);

        // Return index to reprocess the replaced nodes
        return [SKIP, index];
      }
    });
  };
}

/**
 * Count internal markdown links without removing them
 * Useful for analysis and reporting
 *
 * @param tree - Markdown AST
 * @returns Number of internal links found
 */
export function countInternalLinks(tree: Root): number {
  let count = 0;

  visit(tree, 'link', (node: Link) => {
    const url = node.url;
    const isInternalMdLink =
      url.match(/^\.\/[^\)]+\.md/) ||
      url.match(/^(?:\.\.\/)+[^\)]+\.md/);

    if (isInternalMdLink) {
      count++;
    }
  });

  return count;
}
