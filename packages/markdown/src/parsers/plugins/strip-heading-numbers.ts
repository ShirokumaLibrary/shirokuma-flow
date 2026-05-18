import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import type { Heading, Root } from 'mdast';

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
export function remarkStripHeadingNumbers() {
  return (tree: Root) => {
    visit(tree, 'heading', (node: Heading) => {
      const text = toString(node);

      // Match patterns like "1. ", "2.1. ", "3.2.1. " at the beginning
      const match = text.match(/^(\d+(?:\.\d+)*\.)\s+(.+)$/);

      if (match && match[2]) {
        // Replace heading text with version without numbers
        const cleanText = match[2];
        node.children = [{ type: 'text', value: cleanText }];
      }
    });
  };
}

/**
 * Check if markdown contains numbered headings
 * Useful for validation and detection
 *
 * @param tree - Markdown AST
 * @returns True if numbered headings are found
 */
export function hasNumberedHeadings(tree: Root): boolean {
  let found = false;

  visit(tree, 'heading', (node: Heading) => {
    const text = toString(node);
    if (text.match(/^\d+(?:\.\d+)*\.\s/)) {
      found = true;
      return false; // Stop visiting
    }
  });

  return found;
}
