/**
 * zod-4 プリセット
 *
 * Zod 4 ドキュメント向け full-split fetch プリセット。
 * zod.dev/llms-full.txt を H1 区切りで分割して保存する。
 * fumadocs-ui / @/components からの import 行を除去する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats, type FullSplitStrategyMeta } from "./shared.js";
/**
 * zod-4 プリセットのメタ情報。
 * `resolvePresetMeta("zod-4")` が動的 import でこれを取得する。
 */
export declare const meta: FullSplitStrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=zod-4.d.ts.map