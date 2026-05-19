/**
 * vitest-4 プリセット
 *
 * Vitest 4 ドキュメント向け individual fetch プリセット。
 * vitest.dev/llms.txt から各ページを個別に取得する。
 * llms-full.txt も提供されているが、individual プリセットを使用する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats, type IndividualStrategyMeta } from "./shared.js";
/**
 * vitest-4 プリセットのメタ情報。
 * `resolvePresetMeta("vitest-4")` が動的 import でこれを取得する。
 */
export declare const meta: IndividualStrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=vitest-4.d.ts.map