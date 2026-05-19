import type { Config } from '../types/config.js';
import type { Validator, Linter, Analyzer } from '../types/validation.js';
/**
 * Loaded plugins
 */
export interface LoadedPlugins {
    validators: Validator[];
    linters: Linter[];
    analyzers: Analyzer[];
}
/**
 * Load plugins from configuration
 */
export declare function loadPlugins(config: Config): Promise<LoadedPlugins>;
//# sourceMappingURL=loader.d.ts.map