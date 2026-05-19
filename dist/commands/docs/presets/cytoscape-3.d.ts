/**
 * cytoscape-3 プリセット
 *
 * Cytoscape.js 向け fetch プリセット。
 * cytoscape/cytoscape.js リポジトリの documentation/md/ 配下に
 * Markdown ドキュメントを配置しているソース専用。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats } from "./shared.js";
import type { StrategyMeta } from "./shared.js";
/**
 * cytoscape-3 プリセットのメタ情報。
 * `resolvePresetMeta("cytoscape-3")` が動的 import でこれを取得する。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=cytoscape-3.d.ts.map