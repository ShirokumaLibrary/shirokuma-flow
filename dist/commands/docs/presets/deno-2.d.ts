/**
 * deno-2 プリセット
 *
 * Deno 2 ドキュメント向け individual fetch プリセット。
 * docs.deno.com/llms.txt から各ページを個別に取得する。
 * llms-full.txt も提供されているが、individual プリセットを使用する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats, type IndividualStrategyMeta } from "./shared.js";
/**
 * deno-2 プリセットのメタ情報。
 * `resolvePresetMeta("deno-2")` が動的 import でこれを取得する。
 */
export declare const meta: IndividualStrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=deno-2.d.ts.map