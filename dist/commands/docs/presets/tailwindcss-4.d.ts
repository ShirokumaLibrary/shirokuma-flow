/**
 * tailwindcss-4 プリセット
 *
 * Tailwind CSS 向け fetch プリセット。
 * tailwindlabs/tailwindcss.com のように、GitHub リポジトリの指定ディレクトリに
 * Markdown ドキュメントを直接配置しているソース専用。
 *
 * 別の GitHub ベースのドキュメントソースが追加される場合は、
 * shared.ts の GitHub ユーティリティを利用して新しいプリセットファイルを作成すること。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats } from "./shared.js";
import type { StrategyMeta } from "./shared.js";
/**
 * tailwindcss-4 プリセットのメタ情報。
 * `resolvePresetMeta("tailwindcss-4")` が動的 import でこれを取得する。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=tailwindcss-4.d.ts.map