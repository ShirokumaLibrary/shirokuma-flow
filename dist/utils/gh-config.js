/**
 * GitHub CLI Configuration
 *
 * Reads GitHub settings from `shirokuma-docs.config.yaml` (github section).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { LEGACY_STATUS_VALUES } from "./status-workflow.js";
/** Configuration file names (in order of preference) */
const CONFIG_FILES = [
    "shirokuma-docs.config.yaml",
    "shirokuma-docs.config.yml",
];
/** Default metrics configuration.
 *
 * ADR-v3-013 (#2102) で `Completed` ステータスが廃止されたため、デフォルトマッピングから除外する
 * （`Ready` は以前からマッピング対象外）。カスタム設定で追加マッピングを定義した場合は `getMetricsConfig` でマージされる。
 *
 * マッピングキーは GitHub Project の Status field option 名と一致させる必要がある。既存 Project は
 * 旧表記 "In Progress"（大文字 P）のままのため `LEGACY_STATUS_VALUES.IN_PROGRESS_LEGACY` を使用する。
 * 新規 Project で小文字表記に揃える場合は `shirokuma-docs.config.yaml` でユーザー設定を上書きする。 */
const DEFAULT_METRICS = {
    enabled: false,
    statusToDateMapping: {
        [LEGACY_STATUS_VALUES.IN_PROGRESS_LEGACY]: "Start at",
        "Review": "Review at",
        "Done": "End at",
    },
    staleThresholdDays: 14,
};
/** Default configuration */
const DEFAULT_CONFIG = {
    discussionsCategory: "Handovers",
    listLimit: 20,
    defaultStatus: "Backlog",
    labels: {
        feature: "feature",
        bug: "bug",
        chore: "chore",
        docs: "docs",
        research: "research",
    },
};
/** Cached config */
let cachedConfig = null;
let cachedConfigPath = null;
/**
 * Find all config files by walking up from current directory.
 * Returns files from nearest (project-specific) to farthest (workspace root).
 *
 * This enables config inheritance: workspace-level settings (e.g., repoPairs,
 * crossRepos) are inherited by project-specific configs in subdirectories.
 */
function findAllConfigFiles(startDir = process.cwd()) {
    const found = [];
    let dir = startDir;
    const root = "/";
    while (dir !== root) {
        for (const filename of CONFIG_FILES) {
            const configPath = join(dir, filename);
            if (existsSync(configPath)) {
                found.push(configPath);
                break; // Only one config per directory level
            }
        }
        dir = join(dir, "..");
    }
    return found;
}
/**
 * Parse YAML config and extract github section
 */
function parseYamlConfig(content) {
    try {
        const parsed = parseYaml(content);
        const result = {};
        // Parse github section
        if (parsed?.github) {
            const gh = parsed.github;
            if (typeof gh.discussionsCategory === "string") {
                result.discussionsCategory = gh.discussionsCategory;
            }
            if (typeof gh.listLimit === "number") {
                result.listLimit = gh.listLimit;
            }
            if (typeof gh.defaultStatus === "string") {
                result.defaultStatus = gh.defaultStatus;
            }
            if (gh.labels && typeof gh.labels === "object") {
                result.labels = gh.labels;
            }
            if (Array.isArray(gh.labelRules)) {
                result.labelRules = gh.labelRules.filter((rule) => typeof rule?.pattern === "string" && typeof rule?.color === "string");
            }
        }
        // Parse repoPairs section
        if (parsed?.repoPairs && typeof parsed.repoPairs === "object") {
            result.repoPairs = parsed.repoPairs;
        }
        // Parse crossRepos section
        if (parsed?.crossRepos && typeof parsed.crossRepos === "object") {
            result.crossRepos = parsed.crossRepos;
        }
        // Parse metrics section
        if (parsed?.metrics && typeof parsed.metrics === "object") {
            result.metrics = parsed.metrics;
        }
        return result;
    }
    catch {
        return {};
    }
}
/**
 * Load configuration from file(s) or return defaults.
 *
 * Supports config inheritance: finds all config files from CWD up to root,
 * then merges them from farthest (workspace root) to nearest (project-specific).
 * This allows workspace-level settings (repoPairs, crossRepos) to be inherited
 * by project-specific configs in subdirectories.
 */
export function loadGhConfig(projectPath) {
    const searchDir = projectPath || process.cwd();
    // Return cached config if same path
    if (cachedConfig && cachedConfigPath === searchDir) {
        return cachedConfig;
    }
    const configFiles = findAllConfigFiles(searchDir);
    if (configFiles.length === 0) {
        cachedConfig = DEFAULT_CONFIG;
        cachedConfigPath = searchDir;
        return DEFAULT_CONFIG;
    }
    try {
        // Start with defaults
        let mergedConfig = { ...DEFAULT_CONFIG, labels: { ...DEFAULT_CONFIG.labels } };
        // Merge from farthest (workspace root) to nearest (project-specific).
        // Workspace-level settings are set first, then project-level overrides.
        for (const configPath of [...configFiles].reverse()) {
            const content = readFileSync(configPath, "utf-8");
            const parsed = parseYamlConfig(content);
            mergedConfig = {
                ...mergedConfig,
                ...parsed,
                labels: {
                    ...mergedConfig.labels,
                    ...parsed.labels,
                },
                // Only override repoPairs/crossRepos/metrics/labelRules if present in this level
                repoPairs: parsed.repoPairs ?? mergedConfig.repoPairs,
                crossRepos: parsed.crossRepos ?? mergedConfig.crossRepos,
                labelRules: parsed.labelRules ?? mergedConfig.labelRules,
                metrics: parsed.metrics
                    ? {
                        ...DEFAULT_METRICS,
                        ...mergedConfig.metrics,
                        ...parsed.metrics,
                        statusToDateMapping: {
                            ...DEFAULT_METRICS.statusToDateMapping,
                            ...mergedConfig.metrics?.statusToDateMapping,
                            ...parsed.metrics.statusToDateMapping,
                        },
                    }
                    : mergedConfig.metrics,
            };
        }
        cachedConfig = mergedConfig;
        cachedConfigPath = searchDir;
        return cachedConfig;
    }
    catch (error) {
        console.error(`Warning: Failed to parse config: ${String(error)}`);
        cachedConfig = DEFAULT_CONFIG;
        cachedConfigPath = searchDir;
        return DEFAULT_CONFIG;
    }
}
/**
 * Get default discussions category
 */
export function getDefaultCategory(config) {
    const cfg = config || loadGhConfig();
    return cfg.discussionsCategory || "Handovers";
}
/**
 * Get default list limit
 */
export function getDefaultLimit(config) {
    const cfg = config || loadGhConfig();
    return cfg.listLimit || 20;
}
/**
 * Get default status for new issues
 */
export function getDefaultStatus(config) {
    const cfg = config || loadGhConfig();
    return cfg.defaultStatus || "Backlog";
}
/**
 * Get label for issue type
 */
export function getTypeLabel(type, config) {
    const cfg = config || loadGhConfig();
    return cfg.labels?.[type] || type;
}
/**
 * Get metrics configuration with defaults applied.
 * Returns null if metrics is not configured at all.
 */
export function getMetricsConfig(config) {
    const cfg = config || loadGhConfig();
    if (!cfg.metrics)
        return { ...DEFAULT_METRICS };
    return {
        ...DEFAULT_METRICS,
        ...cfg.metrics,
        statusToDateMapping: { ...DEFAULT_METRICS.statusToDateMapping, ...cfg.metrics.statusToDateMapping },
    };
}
/**
 * Clear cached config (for testing)
 */
export function clearConfigCache() {
    cachedConfig = null;
    cachedConfigPath = null;
}
//# sourceMappingURL=gh-config.js.map