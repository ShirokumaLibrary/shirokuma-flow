/**
 * commander-14 プリセット
 *
 * Commander.js 向け fetch プリセット。
 * tj/commander.js リポジトリの docs/ と examples/ 配下に
 * Markdown ドキュメントを配置しているソース専用。
 *
 * docs/zh-CN/ に中国語の翻訳ファイルがあるため、
 * 英語版のみを取得するようフィルタする。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats } from "./shared.js";
import type { StrategyMeta } from "./shared.js";
/**
 * commander-14 プリセットのメタ情報。
 * `resolvePresetMeta("commander-14")` が動的 import でこれを取得する。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=commander-14.d.ts.map