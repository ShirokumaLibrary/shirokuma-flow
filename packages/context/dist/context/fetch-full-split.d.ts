import type { DocsFetchOptions, DocsSourceConfig } from './config-types.js';
import { type Logger } from './logger.js';
import type { FetchStats } from './stats.js';
import type { FullSplitStrategyMeta } from './types.js';
/**
 * `full-split` fetch strategy の実装。
 * `llms-full.txt` を取得し `meta.splitPattern` で複数セクションに分割、
 * 各セクションを `{slug}.md` として保存する。
 *
 * 分割ロジック:
 *   - `matchAll` で分割境界を収集し、境界 → 次境界の範囲を 1 セクションとする
 *   - 最初の境界より前にコンテンツがあればそれも 1 セクション
 *   - 空白のみのセクションはスキップ
 *   - セクション整形は `meta.sectionFormatter`（未指定は passthrough）
 *
 * `llmsContent` は caller が `fetchAndSaveLlmsTxt` で取得して渡す
 * （full-split でも llms.txt からタイトル map を作るため）。
 */
export declare function fetchFullSplit(params: {
    src: DocsSourceConfig;
    outDir: string;
    options: DocsFetchOptions;
    stats: FetchStats;
    llmsContent: string;
    meta: FullSplitStrategyMeta;
    logger?: Logger;
}): Promise<FetchStats>;
//# sourceMappingURL=fetch-full-split.d.ts.map