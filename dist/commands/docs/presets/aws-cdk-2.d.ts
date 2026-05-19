/**
 * aws-cdk-2 プリセット
 *
 * AWS CDK v2 ガイドドキュメント向け fetch プリセット。
 * awsdocs/aws-cdk-guide リポジトリの v2/guide/ 配下に AsciiDoc 形式（.adoc）で
 * ドキュメントが配置されているソース専用。
 *
 * attributes.txt（変数定義ファイル）および book.adoc（目次集約ファイル）は
 * ドキュメントコンテンツではないため除外する。
 * 画像処理は .adoc の image:: 記法のため skip する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats } from "./shared.js";
import type { StrategyMeta } from "./shared.js";
/**
 * aws-cdk-2 プリセットのメタ情報。
 * `resolvePresetMeta("aws-cdk-2")` が動的 import でこれを取得する。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=aws-cdk-2.d.ts.map