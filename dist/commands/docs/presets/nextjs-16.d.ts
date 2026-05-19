/**
 * nextjs-16 プリセット
 *
 * Next.js 16 ドキュメント向け individual fetch プリセット。
 * nextjs.org/docs/llms.txt から各ページを個別に取得する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats, type IndividualStrategyMeta } from "./shared.js";
/**
 * nextjs-16 プリセットのメタ情報。
 * `resolvePresetMeta("nextjs-16")` が動的 import でこれを取得する。
 */
export declare const meta: IndividualStrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=nextjs-16.d.ts.map