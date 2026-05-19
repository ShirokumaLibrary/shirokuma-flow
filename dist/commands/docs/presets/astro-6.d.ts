/**
 * astro-6 プリセット
 *
 * Astro 6 ドキュメント向け full-split fetch プリセット。
 * docs.astro.build/llms-full.txt を H1 区切りで分割して保存する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats, type FullSplitStrategyMeta } from "./shared.js";
/**
 * astro-6 プリセットのメタ情報。
 * `resolvePresetMeta("astro-6")` が動的 import でこれを取得する。
 */
export declare const meta: FullSplitStrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=astro-6.d.ts.map