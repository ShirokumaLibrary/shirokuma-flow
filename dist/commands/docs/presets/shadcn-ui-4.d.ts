/**
 * shadcn-ui プリセット
 *
 * shadcn/ui ドキュメント向け individual fetch プリセット。
 * ui.shadcn.com/llms.txt から各ページを個別に取得する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats, type IndividualStrategyMeta } from "./shared.js";
/**
 * shadcn-ui プリセットのメタ情報。
 * `resolvePresetMeta("shadcn-ui-4")` が動的 import でこれを取得する。
 */
export declare const meta: IndividualStrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=shadcn-ui-4.d.ts.map