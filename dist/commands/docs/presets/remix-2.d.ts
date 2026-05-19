/**
 * remix-2 プリセット
 *
 * Remix 向け fetch プリセット。
 * remix-run/remix リポジトリの docs/ 配下に Markdown ドキュメントを
 * 配置しているソース専用。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats } from "./shared.js";
import type { StrategyMeta } from "./shared.js";
/**
 * remix-2 プリセットのメタ情報。
 * `resolvePresetMeta("remix-2")` が動的 import でこれを取得する。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=remix-2.d.ts.map