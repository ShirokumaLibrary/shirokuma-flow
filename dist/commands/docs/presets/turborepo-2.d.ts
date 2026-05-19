/**
 * turborepo-2 プリセット
 *
 * Turborepo 2 ドキュメント向け full-split fetch プリセット。
 * turborepo.dev/llms-full.txt を frontmatter 区切り（---\ntitle: ）で分割して保存する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats, type FullSplitStrategyMeta } from "./shared.js";
/**
 * turborepo-2 プリセットのメタ情報。
 * `resolvePresetMeta("turborepo-2")` が動的 import でこれを取得する。
 */
export declare const meta: FullSplitStrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=turborepo-2.d.ts.map