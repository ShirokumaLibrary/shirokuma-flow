/**
 * jquery-4 プリセット
 *
 * jQuery 4.x 向け fetch プリセット。
 * jquery/learn.jquery.com リポジトリの page/ 配下に Markdown ドキュメントを配置している。
 * jquery-3 と同じソースリポジトリを使用するが、バージョン識別用に分離している。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats } from "./shared.js";
import type { StrategyMeta } from "./shared.js";
/**
 * jquery-4 プリセットのメタ情報。
 * `resolvePresetMeta("jquery-4")` が動的 import でこれを取得する。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=jquery-4.d.ts.map