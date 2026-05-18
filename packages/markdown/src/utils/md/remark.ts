// Dynamic remark plugin chaining requires any-typed processor intermediate.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
export async function processMarkdown(
  content: string,
  options: RemarkProcessOptions = {}
): Promise<string> {
  const { gfm = true, plugins = [] } = options;

  // Use any type for processor to avoid type errors with dynamic plugin loading
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processor: any = unified().use(remarkParse);

  // Add GitHub Flavored Markdown support
  if (gfm) {
    processor = processor.use(remarkGfm);
  }

  // Add custom plugins
  for (const plugin of plugins) {
    processor = processor.use(plugin);
  }

  // Add stringify at the end
  processor = processor.use(remarkStringify, {
    bullet: '-',
    fence: '`',
    fences: true,
    incrementListMarker: false,
  });

  const result = await processor.process(content);
  return String(result);
}

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
export async function parseMarkdown(
  content: string,
  options: RemarkProcessOptions = {}
): Promise<VFile> {
  const { gfm = true, plugins = [] } = options;

  // Use any type for processor to avoid type errors with dynamic plugin loading
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processor: any = unified().use(remarkParse);

  if (gfm) {
    processor = processor.use(remarkGfm);
  }

  for (const plugin of plugins) {
    processor = processor.use(plugin);
  }

  return await processor.process(content);
}

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
export function getAST(content: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm);

  return processor.parse(content);
}

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
export function stringifyAST(ast: Root): string {
  const processor = unified().use(remarkStringify, {
    bullet: '-',
    fence: '`',
    fences: true,
    incrementListMarker: false,
  });

  const file = processor.stringify(ast);
  return String(file);
}
