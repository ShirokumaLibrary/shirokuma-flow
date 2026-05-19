/**
 * playwright-1 プリセット
 *
 * Playwright 向け fetch プリセット。
 * microsoft/playwright リポジトリの docs/src/ 配下に Markdown ドキュメントを
 * 配置しているソース専用。
 *
 * Playwright は同一トピックを言語別ファイル（-java.md, -python.md, -csharp.md）で
 * 管理しているため、JS/共通ファイルのみをフィルタして取得する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats } from "./shared.js";
import type { StrategyMeta } from "./shared.js";
/**
 * playwright-1 プリセットのメタ情報。
 * `resolvePresetMeta("playwright-1")` が動的 import でこれを取得する。
 */
export declare const meta: StrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=playwright-1.d.ts.map