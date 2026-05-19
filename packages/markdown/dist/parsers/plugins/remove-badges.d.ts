import type { Root } from 'mdast';
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
export declare function remarkRemoveBadges(): (tree: Root) => void;
//# sourceMappingURL=remove-badges.d.ts.map