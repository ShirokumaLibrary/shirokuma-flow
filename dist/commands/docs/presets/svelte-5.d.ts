/**
 * svelte-5 プリセット
 *
 * Svelte 5 ドキュメント向け full-split fetch プリセット。
 * svelte.dev/llms-full.txt を H1 区切りで分割して保存する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats, type FullSplitStrategyMeta } from "./shared.js";
/**
 * svelte-5 プリセットのメタ情報。
 * `resolvePresetMeta("svelte-5")` が動的 import でこれを取得する。
 */
export declare const meta: FullSplitStrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=svelte-5.d.ts.map