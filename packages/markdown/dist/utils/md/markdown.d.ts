import type { HeadingNode } from '../../parsers/types/validation.js';
/**
 * Parse markdown content and extract heading structure
 */
export declare function parseHeadings(content: string): HeadingNode[];
/**
 * Count total number of headings
 */
export declare function countHeadings(headings: HeadingNode[]): number;
/**
 * Get all headings as flat list
 */
export declare function flattenHeadings(headings: HeadingNode[]): HeadingNode[];
/**
 * Count lines in content
 */
export declare function countLines(content: string): number;
//# sourceMappingURL=markdown.d.ts.map