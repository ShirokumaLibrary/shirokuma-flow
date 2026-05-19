import type { Root } from 'mdast';
import type { VFile } from 'vfile';
/**
 * Options for remark processing
 */
export interface RemarkProcessOptions {
    /**
     * Enable GitHub Flavored Markdown
     * @default true
     */
    gfm?: boolean;
    /**
     * Remark plugins to apply
     */
    plugins?: Array<any>;
}
/**
 * Process markdown content with remark
 *
 * @param content - Markdown content to process
 * @param options - Processing options
 * @returns Processed markdown content
 *
 * @example
 * ```typescript
 * import { processMarkdown } from './utils/remark.js';
 * import { remarkNormalizeHeadings } from './plugins/normalize-headings.js';
 *
 * const result = await processMarkdown(content, {
 *   plugins: [remarkNormalizeHeadings({ separator: ' / ' })],
 * });
 * ```
 */
export declare function processMarkdown(content: string, options?: RemarkProcessOptions): Promise<string>;
/**
 * Parse markdown into AST without stringify
 *
 * @param content - Markdown content to parse
 * @param options - Processing options
 * @returns VFile with AST
 *
 * @example
 * ```typescript
 * import { parseMarkdown } from './utils/remark.js';
 *
 * const file = await parseMarkdown(content);
 * console.log(file.data); // Access AST
 * ```
 */
export declare function parseMarkdown(content: string, options?: RemarkProcessOptions): Promise<VFile>;
/**
 * Get AST from markdown content
 *
 * @param content - Markdown content
 * @returns Markdown AST (Root node)
 *
 * @example
 * ```typescript
 * import { getAST } from './utils/remark.js';
 * import { visit } from 'unist-util-visit';
 *
 * const ast = await getAST(content);
 * visit(ast, 'heading', (node) => {
 *   console.log(node);
 * });
 * ```
 */
export declare function getAST(content: string): Root;
/**
 * Stringify AST back to markdown
 *
 * @param ast - Markdown AST
 * @returns Markdown string
 *
 * @example
 * ```typescript
 * import { getAST, stringifyAST } from './utils/remark.js';
 * import { visit } from 'unist-util-visit';
 *
 * const ast = await getAST(content);
 *
 * // Modify AST
 * visit(ast, 'heading', (node) => {
 *   // Transform headings
 * });
 *
 * const markdown = await stringifyAST(ast);
 * ```
 */
export declare function stringifyAST(ast: Root): string;
//# sourceMappingURL=remark.d.ts.map