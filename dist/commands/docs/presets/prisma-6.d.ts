/**
 * prisma-6 プリセット
 *
 * Prisma 6 ドキュメント向け full-split fetch プリセット。
 * prisma.io/docs/llms-full.txt を "# title (/docs" パターン区切りで分割して保存する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats, type FullSplitStrategyMeta } from "./shared.js";
/**
 * prisma-6 プリセットのメタ情報。
 * `resolvePresetMeta("prisma-6")` が動的 import でこれを取得する。
 */
export declare const meta: FullSplitStrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=prisma-6.d.ts.map