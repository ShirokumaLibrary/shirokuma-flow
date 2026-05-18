import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const MARKER_DIR = '.shirokuma';

/**
 * Walk up from `startPath` looking for a directory containing `.shirokuma/`.
 * Returns the containing directory (the "project root") or null if none is
 * found before the filesystem root. `.shirokuma/` must be a direct child —
 * downward scans are not performed. An optional `stopAt` bounds the walk
 * (useful for tests that sit inside a tmpdir whose ancestors may contain
 * unrelated `.shirokuma/` directories).
 */
export function discoverProjectRoot(startPath: string, stopAt?: string): string | null {
  const limit = stopAt !== undefined ? resolve(stopAt) : null;
  let current = resolve(startPath);
  while (true) {
    if (existsSync(join(current, MARKER_DIR))) return current;
    if (limit !== null && current === limit) return null;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * Return the path to `.shirokuma/lint/<ruleName>.{yaml,yml}` under `projectRoot`
 * when the file exists, or null otherwise. `.yaml` takes precedence over `.yml`.
 */
export function resolveAutoConfigPath(projectRoot: string | null, ruleName: string): string | null {
  if (projectRoot === null) return null;
  const base = join(projectRoot, MARKER_DIR, 'lint', ruleName);
  for (const ext of ['.yaml', '.yml'] as const) {
    const candidate = `${base}${ext}`;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
