/**
 * Repo Pairs Utility
 *
 * Central utility for public/private repository pair management.
 * Used by repo-pairs command, --public flag, and session management.
 */
import { getRepoInfo } from "./github.js";
import { loadGhConfig } from "./gh-config.js";
import { loadShirokumaIgnoreFile, mergeExcludePatterns } from "./shirokumaignore.js";
// ========================================
// Default Patterns
// ========================================
/** Default files/directories to exclude from public release */
export const DEFAULT_EXCLUDE_PATTERNS = [
    ".claude/",
    ".github/DISCUSSION_TEMPLATE/",
    "docs/internal/",
    ".shirokumaignore",
];
// ========================================
// Repo Pair Resolution
// ========================================
/**
 * Parse "owner/name" into { owner, name }
 */
export function parseRepoFullName(fullName) {
    const parts = fullName.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return null;
    }
    return { owner: parts[0], name: parts[1] };
}
/**
 * Get all configured repo pairs
 */
export function getAllRepoPairs(config) {
    const cfg = config ?? loadGhConfig();
    if (!cfg.repoPairs)
        return [];
    return Object.entries(cfg.repoPairs).map(([alias, pair]) => ({
        alias,
        private: pair.private,
        public: pair.public,
        exclude: pair.exclude ?? DEFAULT_EXCLUDE_PATTERNS,
        defaultBranch: pair.defaultBranch ?? "main",
        ...(pair.sourceDir && { sourceDir: pair.sourceDir }),
    }));
}
/**
 * Get a specific repo pair by alias
 */
export function getRepoPair(alias, config) {
    const pairs = getAllRepoPairs(config);
    return pairs.find(p => p.alias === alias) ?? null;
}
/**
 * Detect which repo pair matches the current repository.
 * Checks if current repo matches either the private or public side.
 */
export function detectCurrentRepoPair(config) {
    const repoInfo = getRepoInfo();
    if (!repoInfo)
        return null;
    const currentFullName = `${repoInfo.owner}/${repoInfo.name}`;
    const pairs = getAllRepoPairs(config);
    return pairs.find(p => p.private === currentFullName || p.public === currentFullName) ?? null;
}
/**
 * Resolve target repository for --public flag.
 *
 * When --public is passed, finds the matching repo pair for the current repo
 * and returns the public counterpart.
 *
 * @returns { owner, name } of the target repo, or null if not found
 */
export function resolveTargetRepo(options, config) {
    const cfg = config ?? loadGhConfig();
    // If --repo alias is specified (cross-repo), resolve from crossRepos
    if (options.repo) {
        return resolveCrossRepo(options.repo, cfg);
    }
    // If --public is not set, return current repo
    if (!options.public) {
        return getRepoInfo();
    }
    // Find the repo pair for current repo
    const pair = detectCurrentRepoPair(cfg);
    if (!pair)
        return null;
    return parseRepoFullName(pair.public);
}
/**
 * Resolve a cross-repo alias to { owner, name }
 */
export function resolveCrossRepo(alias, config) {
    const cfg = config ?? loadGhConfig();
    if (!cfg.crossRepos)
        return null;
    const fullName = cfg.crossRepos[alias];
    if (!fullName)
        return null;
    return parseRepoFullName(fullName);
}
/**
 * Get all configured cross-repo aliases
 */
export function getAllCrossRepos(config) {
    const cfg = config ?? loadGhConfig();
    if (!cfg.crossRepos)
        return [];
    return Object.entries(cfg.crossRepos).map(([alias, repo]) => ({ alias, repo }));
}
/**
 * Validate a cross-repo alias and return detailed error info if invalid.
 *
 * Checks:
 * 1. Is it a known alias?
 * 2. Is it a full path (owner/repo) instead of an alias?
 * 3. Are there any configured aliases at all?
 *
 * @returns null if valid, error message string if invalid
 */
export function validateCrossRepoAlias(alias, config) {
    const cfg = config ?? loadGhConfig();
    const crossRepos = cfg.crossRepos;
    // No crossRepos configured at all
    if (!crossRepos || Object.keys(crossRepos).length === 0) {
        return `No cross-repo aliases configured.\nAdd crossRepos to shirokuma-docs.config.yaml:\n  crossRepos:\n    myalias: "owner/repo"`;
    }
    // Check if alias exists
    if (crossRepos[alias]) {
        return null; // Valid
    }
    const availableAliases = Object.entries(crossRepos)
        .map(([a, repo]) => `  ${a} (${repo})`)
        .join("\n");
    // Check if input looks like a full path (owner/repo)
    if (alias.includes("/")) {
        // Check if this full path matches any configured repo
        const matchingAlias = Object.entries(crossRepos).find(([, repo]) => repo === alias);
        if (matchingAlias) {
            return `Use the alias '${matchingAlias[0]}' instead of '${alias}'.\nAvailable aliases:\n${availableAliases}`;
        }
        return `Unknown repo '${alias}'.\nUse a configured alias instead of owner/repo.\nAvailable aliases:\n${availableAliases}\nSee crossRepos in shirokuma-docs.config.yaml`;
    }
    // Unknown alias
    return `Unknown repo alias '${alias}'.\nAvailable aliases:\n${availableAliases}\nSee crossRepos in shirokuma-docs.config.yaml`;
}
/**
 * Check if a repo full name matches the private side of any pair
 */
export function isPrivateRepo(repoFullName, config) {
    const pairs = getAllRepoPairs(config);
    return pairs.some(p => p.private === repoFullName);
}
/**
 * Check if a repo full name matches the public side of any pair
 */
export function isPublicRepo(repoFullName, config) {
    const pairs = getAllRepoPairs(config);
    return pairs.some(p => p.public === repoFullName);
}
// ========================================
// Merged Exclude Patterns
// ========================================
/**
 * Get merged exclude patterns for a repo pair release.
 *
 * Combines patterns from three sources (in order):
 * 1. DEFAULT_EXCLUDE_PATTERNS (built-in base patterns)
 * 2. Config patterns (repoPairs[alias].exclude in config YAML)
 * 3. .shirokumaignore file patterns (project root)
 *
 * Patterns are deduplicated while preserving order.
 *
 * @param alias - Repo pair alias
 * @param projectPath - Absolute path to the project root
 * @param config - Optional pre-loaded config
 * @returns Deduplicated array of all exclude patterns
 */
export function getMergedExcludePatterns(alias, projectPath, config) {
    const cfg = config ?? loadGhConfig();
    // Access raw config to check if exclude was explicitly set.
    // Note: getRepoPair() → getAllRepoPairs() applies fallback
    // (pair.exclude ?? DEFAULT_EXCLUDE_PATTERNS), so pair.exclude
    // is never undefined there. We need the raw config value.
    const rawExclude = cfg.repoPairs?.[alias]?.exclude;
    // .shirokumaignore file patterns
    const filePatterns = loadShirokumaIgnoreFile(projectPath);
    // If no explicit exclude config, use only defaults + file patterns
    if (rawExclude === undefined) {
        return mergeExcludePatterns(DEFAULT_EXCLUDE_PATTERNS, [], filePatterns);
    }
    // Explicit config: merge defaults + config + file patterns
    return mergeExcludePatterns(DEFAULT_EXCLUDE_PATTERNS, rawExclude, filePatterns);
}
//# sourceMappingURL=repo-pairs.js.map