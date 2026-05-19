/**
 * payload-3 プリセット
 *
 * Payload CMS 3.x 向け full-split fetch プリセット。
 * payloadcms.com/llms-full.txt を H1 区切りで分割して保存する。
 *
 * llms.txt の各リンクがパス階層を持ち basename が衝突するため、
 * full-split 戦略を使用して llms-full.txt を H1 単位で分割する。
 *
 * stripLinePattern で Source: 行（ページ URL 参照）と
 * JSX コンポーネント（<YouTube id=... /> 等）を除去する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats, type FullSplitStrategyMeta } from "./shared.js";
/**
 * payload-3 プリセットのメタ情報。
 * `resolvePresetMeta("payload-3")` が動的 import でこれを取得する。
 */
export declare const meta: FullSplitStrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=payload-3.d.ts.map