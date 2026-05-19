/**
 * .shirokumaignore Parser
 *
 * Parses .shirokumaignore files (gitignore-like syntax) for excluding
 * files/directories from public repository releases via repo-pairs.
 *
 * Supported syntax:
 * - Comments: lines starting with #
 * - Blank lines: ignored
 * - Glob patterns: same as rsync --exclude
 * - Inline comments: `pattern # comment` (stripped)
 * - CRLF line endings: handled transparently
 */
/** File name for project-level ignore patterns */
export declare const SHIROKUMAIGNORE_FILENAME = ".shirokumaignore";
/**
 * Parse .shirokumaignore content into an array of exclude patterns.
 *
 * Rules:
 * - Lines starting with # are comments (ignored)
 * - Empty/whitespace-only lines are ignored
 * - Leading/trailing whitespace is trimmed
 * - Inline comments (` # ...`) are stripped
 * - CRLF line endings are handled
 *
 * @param content - Raw file content
 * @returns Array of exclude pattern strings
 */
export declare function parseShirokumaIgnore(content: string): string[];
/**
 * Load .shirokumaignore file from a project directory.
 *
 * Returns an empty array if the file does not exist or cannot be read.
 * This makes the feature optional - projects without .shirokumaignore
 * simply use config-only patterns.
 *
 * @param projectPath - Absolute path to the project root
 * @returns Array of exclude patterns (empty if file not found)
 */
export declare function loadShirokumaIgnoreFile(projectPath: string): string[];
/**
 * Merge exclude patterns from multiple sources with deduplication.
 *
 * Priority order (all are additive):
 * 1. Default patterns (base, always included)
 * 2. Config patterns (from shirokuma-docs.config.yaml)
 * 3. File patterns (from .shirokumaignore)
 *
 * @param defaultPatterns - Built-in default exclude patterns
 * @param configPatterns - Patterns from config file
 * @param filePatterns - Patterns from .shirokumaignore file
 * @returns Deduplicated merged array of all patterns
 */
export declare function mergeExcludePatterns(defaultPatterns: string[], configPatterns: string[], filePatterns: string[]): string[];
//# sourceMappingURL=shirokumaignore.d.ts.map