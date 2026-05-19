/**
 * cloudflare-workers プリセット
 *
 * Cloudflare Workers 向けカスタム fetch プリセット。
 * developers.cloudflare.com/workers/llms-full.txt を
 * フロントマターブロック（`---\ntitle:...\n---`）単位で分割して保存する。
 *
 * llms.txt の各リンクが `index.md` 形式のネストされたパスになっており、
 * individual 戦略の basename 保存ではファイル名が衝突するため、
 * llms-full.txt の全コンテンツをフロントマターで区切り分割する。
 *
 * 各ページのフロントマター title フィールドをファイル名に使用する。
 * ナビゲーション残滓（"Was this helpful?", "YesNo" 等）は除去する。
 */
import type { DocsSourceConfig } from "../../../utils/config.js";
import type { Logger } from "../../../utils/logger.js";
import type { DocsFetchOptions } from "../fetch.js";
import { type FetchStats, type FullSplitStrategyMeta } from "./shared.js";
/**
 * cloudflare-workers プリセットのメタ情報。
 * `resolvePresetMeta("cloudflare-workers")` が動的 import でこれを取得する。
 */
export declare const meta: FullSplitStrategyMeta;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export declare function execute(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger): Promise<FetchStats>;
//# sourceMappingURL=cloudflare-workers.d.ts.map