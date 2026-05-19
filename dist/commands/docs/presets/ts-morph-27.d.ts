/**
 * ts-morph-27 プリセット
 *
 * ts-morph 向け fetch プリセット。
 * dsherret/ts-morph リポジトリの docs/ 配下に Markdown ドキュメントを
 * 配置しているソース専用。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats } from "./shared.js";
import type { StrategyMeta } from "./shared.js";
/**
 * ts-morph-27 プリセットのメタ情報。
 * `resolvePresetMeta("ts-morph-27")` が動的 import でこれを取得する。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=ts-morph-27.d.ts.map