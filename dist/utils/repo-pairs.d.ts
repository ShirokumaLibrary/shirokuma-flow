/**
 * Repo Pairs Utility
 *
 * Central utility for public/private repository pair management.
 * Used by repo-pairs command, --public flag, and session management.
 */
import { type RepoPairConfig, type GhConfig } from "./gh-config.js";
/** Default files/directories to exclude from public release */
export declare const DEFAULT_EXCLUDE_PATTERNS: string[];
/**
 * Parse "owner/name" into { owner, name }
 */
export declare function parseRepoFullName(fullName: string): {
    owner: string;
    name: string;
} | null;
/**
 * Get all configured repo pairs
 */
export declare function getAllRepoPairs(config?: GhConfig): RepoPairConfig[];
/**
 * Get a specific repo pair by alias
 */
export declare function getRepoPair(alias: string, config?: GhConfig): RepoPairConfig | null;
/**
 * Detect which repo pair matches the current repository.
 * Checks if current repo matches either the private or public side.
 */
export declare function detectCurrentRepoPair(config?: GhConfig): RepoPairConfig | null;
/**
 * Resolve target repository for --public flag.
 *
 * When --public is passed, finds the matching repo pair for the current repo
 * and returns the public counterpart.
 *
 * @returns { owner, name } of the target repo, or null if not found
 */
export declare function resolveTargetRepo(options: {
    public?: boolean;
    repo?: string;
}, config?: GhConfig): {
    owner: string;
    name: string;
} | null;
/**
 * Resolve a cross-repo alias to { owner, name }
 */
export declare function resolveCrossRepo(alias: string, config?: GhConfig): {
    owner: string;
    name: string;
} | null;
/**
 * Get all configured cross-repo aliases
 */
export declare function getAllCrossRepos(config?: GhConfig): Array<{
    alias: string;
    repo: string;
}>;
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
export declare function validateCrossRepoAlias(alias: string, config?: GhConfig): string | null;
/**
 * Check if a repo full name matches the private side of any pair
 */
export declare function isPrivateRepo(repoFullName: string, config?: GhConfig): boolean;
/**
 * Check if a repo full name matches the public side of any pair
 */
export declare function isPublicRepo(repoFullName: string, config?: GhConfig): boolean;
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
export declare function getMergedExcludePatterns(alias: string, projectPath: string, config?: GhConfig): string[];
//# sourceMappingURL=repo-pairs.d.ts.map