import { visit, SKIP } from 'unist-util-visit';
import type { Root, Image } from 'mdast';

/**
 * Remark plugin to remove badge images from markdown
 *
 * Removes build badges, status images, and other visual noise:
 * ![Build Status](https://img.shields.io/github/workflow/status/...)
 * ![Coverage](https://codecov.io/gh/...)
 * ![Version](https://img.shields.io/npm/v/...)
 *
 * Token savings: ~20-100 tokens per badge
 *
 * Detects common badge patterns:
 * - shields.io badges
 * - Travis CI badges
 * - CircleCI badges
 * - GitHub Actions badges
 * - Codecov badges
 * - npm version badges
 *
 * @example
 * ```typescript
 * import { unified } from 'unified';
 * import remarkParse from 'remark-parse';
 * import remarkStringify from 'remark-stringify';
 * import { remarkRemoveBadges } from './plugins/remove-badges.js';
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(remarkRemoveBadges)
 *   .use(remarkStringify);
 *
 * const result = await processor.process(markdown);
 * ```
 */
export function remarkRemoveBadges() {
  const badgePatterns = [
    /shields\.io/i,
    /badge/i,
    /travis-ci/i,
    /circleci/i,
    /github\.com\/.*\/workflows\/.*\/badge\.svg/i,
    /codecov\.io/i,
    /img\.shields\.io/i,
    /badgen\.net/i,
  ];

  return (tree: Root) => {
    visit(tree, 'image', (node: Image, index, parent) => {
      // Check if image URL matches any badge pattern
      if (badgePatterns.some(pattern => pattern.test(node.url))) {
        // Remove badge image
        if (parent && typeof index === 'number') {
          parent.children.splice(index, 1);
          return [SKIP, index];
        }
      }
    });
  };
}
