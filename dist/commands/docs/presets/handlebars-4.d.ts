/**
 * handlebars-4 プリセット
 *
 * Handlebars 向け fetch プリセット。
 * handlebars-lang/docs リポジトリの src/ 配下に Markdown ドキュメントを
 * 配置しているソース専用。
 *
 * src/ko/, src/zh/ に韓国語・中国語の翻訳ファイルがあるため、
 * 英語版のみを取得するようフィルタする。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats } from "./shared.js";
import type { StrategyMeta } from "./shared.js";
/**
 * handlebars-4 プリセットのメタ情報。
 * `resolvePresetMeta("handlebars-4")` が動的 import でこれを取得する。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=handlebars-4.d.ts.map