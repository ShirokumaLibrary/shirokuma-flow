/**
 * Walk up from `startPath` looking for a directory containing `.shirokuma/`.
 * Returns the containing directory (the "project root") or null if none is
 * found before the filesystem root. `.shirokuma/` must be a direct child —
 * downward scans are not performed. An optional `stopAt` bounds the walk
 * (useful for tests that sit inside a tmpdir whose ancestors may contain
 * unrelated `.shirokuma/` directories).
 */
export declare function discoverProjectRoot(startPath: string, stopAt?: string): string | null;
/**
 * Return the path to `.shirokuma/lint/<ruleName>.{yaml,yml}` under `projectRoot`
 * when the file exists, or null otherwise. `.yaml` takes precedence over `.yml`.
 */
export declare function resolveAutoConfigPath(projectRoot: string | null, ruleName: string): string | null;
//# sourceMappingURL=project-root.d.ts.map