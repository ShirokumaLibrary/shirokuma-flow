import { type Logger } from './logger.js';
import type { PresetName } from './presets.js';
import type { FetchStats } from './stats.js';
import type { DocsFetchOptions, DocsSourceConfig } from './config-types.js';
import type { PresetExecutor } from './presets/types.js';
export declare function loadPresetExecutor(name: string): PresetExecutor | null;
export interface ExecutePresetParams {
    src: DocsSourceConfig;
    outDir: string;
    options: DocsFetchOptions;
    stats: FetchStats;
    /** 省略時は `NOOP_LOGGER` を使用。 */
    logger?: Logger;
}
export declare function executePreset(name: PresetName | string, params: ExecutePresetParams): Promise<FetchStats>;
//# sourceMappingURL=execute-preset.d.ts.map