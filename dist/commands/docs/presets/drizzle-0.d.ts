/**
 * drizzle-0 プリセット
 *
 * Drizzle ORM ドキュメント向け full-split fetch プリセット。
 * orm.drizzle.team/llms-full.txt を "Source: https://orm.drizzle.team/" 区切りで分割し、
 * metadata-to-frontmatter フォーマッタで frontmatter 形式に変換して保存する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats, type FullSplitStrategyMeta } from "./shared.js";
/**
 * drizzle-0 プリセットのメタ情報。
 * `resolvePresetMeta("drizzle-0")` が動的 import でこれを取得する。
 */
export declare const meta: FullSplitStrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=drizzle-0.d.ts.map