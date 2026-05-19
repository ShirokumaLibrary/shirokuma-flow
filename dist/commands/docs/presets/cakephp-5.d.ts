/**
 * cakephp-5 プリセット
 *
 * CakePHP 5.x 向け fetch プリセット。
 * cakephp/docs リポジトリの docs/en/ 配下に Markdown ドキュメントを配置している。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats } from "./shared.js";
import type { StrategyMeta } from "./shared.js";
/**
 * cakephp-5 プリセットのメタ情報。
 * `resolvePresetMeta("cakephp-5")` が動的 import でこれを取得する。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=cakephp-5.d.ts.map