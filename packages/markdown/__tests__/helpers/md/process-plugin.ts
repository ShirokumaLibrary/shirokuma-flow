/**
 * Shared test helper for remark plugin processing
 *
 * remark プラグインテスト共通のパイプラインヘルパー
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";

/**
 * remark プラグインを適用して Markdown を変換する
 *
 * unified Plugin の型パラメータが複雑なため、plugin 引数の型は緩めに定義。
 */
export async function processWithPlugin(
  md: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugin: any,
  options?: Record<string, unknown>,
): Promise<string> {
  const processor = unified().use(remarkParse);
  if (options) {
    processor.use(plugin, options);
  } else {
    processor.use(plugin);
  }
  processor.use(remarkStringify);
  const result = await processor.process(md);
  return String(result);
}
