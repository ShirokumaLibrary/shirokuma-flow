// Dynamic plugin loading uses runtime any types; suppress unsafe-* for this file.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import * as path from 'path';
/**
 * Load plugins from configuration
 */
export async function loadPlugins(config) {
    const loaded = {
        validators: [],
        linters: [],
        analyzers: [],
    };
    if (!config.plugins || config.plugins.length === 0) {
        return loaded;
    }
    for (const pluginConfig of config.plugins) {
        // Skip disabled plugins
        if (pluginConfig.enabled === false) {
            continue;
        }
        try {
            // Resolve plugin module path
            const modulePath = path.resolve(pluginConfig.module);
            // Security: Validate plugin path to prevent path traversal
            // Only allow:
            // 1. Scoped npm packages (@org/package)
            // 2. Unscoped npm packages (package-name)
            // 3. Relative paths within project (./plugins/*, ../plugins/*)
            const normalized = path.normalize(modulePath);
            const isNpmPackage = !pluginConfig.module.startsWith('.') && !pluginConfig.module.startsWith('/');
            const isRelativeWithinProject = pluginConfig.module.startsWith('./') || pluginConfig.module.startsWith('../');
            if (!isNpmPackage && !isRelativeWithinProject) {
                throw new Error(`Plugin path "${pluginConfig.module}" is not allowed. ` +
                    `Use npm package names (e.g., "my-plugin") or relative paths (e.g., "./plugins/my-plugin")`);
            }
            // Prevent path traversal beyond project root
            const projectRoot = process.cwd();
            if (isRelativeWithinProject && !normalized.startsWith(projectRoot)) {
                throw new Error(`Plugin path "${pluginConfig.module}" attempts to access files outside project root. ` +
                    `This is not allowed for security reasons.`);
            }
            // Dynamic import
            const pluginModule = await import(modulePath);
            // Load validators
            if (pluginConfig.validators && Array.isArray(pluginConfig.validators)) {
                for (const validatorName of pluginConfig.validators) {
                    if (pluginModule[validatorName]) {
                        const ValidatorClass = pluginModule[validatorName];
                        const validator = new ValidatorClass(pluginConfig.config || {});
                        // Validate interface
                        if (!validator.name || typeof validator.validate !== 'function') {
                            throw new Error(`Validator ${validatorName} does not implement Validator interface`);
                        }
                        loaded.validators.push(validator);
                    }
                    else {
                        throw new Error(`Validator ${validatorName} not found in ${pluginConfig.module}`);
                    }
                }
            }
            // Load default export if it's a validator/linter/analyzer
            if (pluginModule.default) {
                const plugin = pluginModule.default;
                if (plugin.validate && typeof plugin.validate === 'function') {
                    loaded.validators.push(plugin);
                }
                if (plugin.lint && typeof plugin.lint === 'function') {
                    loaded.linters.push(plugin);
                }
                if (plugin.analyze && typeof plugin.analyze === 'function') {
                    loaded.analyzers.push(plugin);
                }
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to load plugin ${pluginConfig.module}: ${message}`);
        }
    }
    return loaded;
}
//# sourceMappingURL=loader.js.map