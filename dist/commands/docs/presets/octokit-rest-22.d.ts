/**
 * octokit-rest-22 プリセット
 *
 * @octokit/rest 向け fetch プリセット。
 * octokit/rest.js リポジトリの docs/src/pages/api/ 配下に Markdown ドキュメントを
 * 配置しているソース専用。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats } from "./shared.js";
import type { StrategyMeta } from "./shared.js";
/**
 * octokit-rest-22 プリセットのメタ情報。
 * `resolvePresetMeta("octokit-rest-22")` が動的 import でこれを取得する。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=octokit-rest-22.d.ts.map