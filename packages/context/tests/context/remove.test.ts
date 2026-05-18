import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeSource } from '../../src/context/remove.js';
import { formatManifest } from '../../src/context/manifest.js';

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-remove-'));
  return Promise.resolve(run(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

describe('removeSource', () => {
  it('removes the output dir and manifest entry', async () => {
    await withTmp(async (root) => {
      const docsRoot = join(root, '.shirokuma', 'contexts');
      const bun = join(docsRoot, 'bun');
      mkdirSync(bun, { recursive: true });
      writeFileSync(join(bun, 'a.md'), 'x');
      writeFileSync(
        join(docsRoot, 'MANIFEST.md'),
        formatManifest([
          { source: 'bun', package: 'bun', lastFetched: '2026-04-19', fileCount: 1 },
          { source: 'astro', package: 'astro', lastFetched: '2026-04-19', fileCount: 2 },
        ]),
      );

      const result = removeSource({ projectPath: root, sourceName: 'bun' });

      expect(result.removed).toBe(true);
      expect(existsSync(bun)).toBe(false);
      const manifest = readFileSync(join(docsRoot, 'MANIFEST.md'), 'utf-8');
      expect(manifest).not.toContain('| bun |');
      expect(manifest).toContain('| astro |');
    });
  });

  it('reports removed=false when target does not exist', async () => {
    await withTmp((root) => {
      const result = removeSource({ projectPath: root, sourceName: 'missing' });
      expect(result.removed).toBe(false);
    });
  });
});
