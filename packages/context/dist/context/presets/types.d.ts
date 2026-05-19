import type { DocsFetchOptions, DocsSourceConfig } from '../config-types.js';
import type { Logger } from '../logger.js';
import type { FetchStats } from '../stats.js';
/**
 * 各プリセット `execute` が受け取る params。
 * `logger` は必須で、`executePreset` の externally-facing 版が未指定時に
 * `NOOP_LOGGER` で default 化する。プリセット本体は logger の存在を前提に書ける。
 */
export interface PresetExecuteParams {
    src: DocsSourceConfig;
    outDir: string;
    options: DocsFetchOptions;
    stats: FetchStats;
    logger: Logger;
}
export type PresetExecutor = (params: PresetExecuteParams) => Promise<FetchStats>;
//# sourceMappingURL=types.d.ts.map