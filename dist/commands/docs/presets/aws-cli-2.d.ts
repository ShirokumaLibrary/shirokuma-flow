/**
 * aws-cli-2 プリセット
 *
 * AWS CLI v2 ユーザーガイド向け fetch プリセット。
 * docs.aws.amazon.com/cli/latest/userguide/llms.txt からセクション構造を解析し、
 * 各 HTML ページを fetch → turndown で Markdown に変換してディレクトリ分割保存する。
 *
 * llms.txt 構造:
 * - `## [セクション名](url)` でセクションが始まる
 * - `- [タイトル](*.html)` でページエントリが続く
 * セクションごとにサブディレクトリを作成し、スラッグ化したタイトルでファイルを保存する。
 *
 * 並行度制御: 同時に CONCURRENCY 件の HTML fetch を実行し、サーバー負荷を抑える。
 * エラー処理: 個別ページの fetch 失敗はスキップして続行する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats, type StrategyMeta } from "./shared.js";
/**
 * aws-cli-2 プリセットのメタ情報。
 * `resolvePresetMeta("aws-cli-2")` が動的 import でこれを取得する。
 * packageNames は未定義（AWS CLI は npm パッケージではなく detect 対象外）。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=aws-cli-2.d.ts.map