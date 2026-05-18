import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  formatManifest,
  parseManifest,
  removeManifestEntry,
  writeManifest,
  type ManifestEntry,
} from '../../src/context/manifest.js';

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-manifest-'));
  return Promise.resolve(run(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

const SAMPLE_ENTRIES: ManifestEntry[] = [
  { source: 'bun', package: 'bun-types', lastFetched: '2026-04-19', fileCount: 10 },
  { source: 'astro', package: 'astro', lastFetched: '2026-04-18', fileCount: 50 },
];

describe('formatManifest / parseManifest', () => {
  it('round-trips entries', () => {
    const md = formatManifest(SAMPLE_ENTRIES);
    const parsed = parseManifest(md);
    // sorted ascending by source in formatManifest
    expect(parsed.map((e) => e.source)).toEqual(['astro', 'bun']);
    expect(parsed[0]).toMatchObject({ source: 'astro', package: 'astro', fileCount: 50 });
  });

  it('returns "(ソースなし)" body when empty', () => {
    const md = formatManifest([]);
    expect(md).toContain('(ソースなし)');
    expect(parseManifest(md)).toEqual([]);
  });

  it('ignores rows that do not match the full column pattern', () => {
    // header row "| ソース | パッケージ | Last Fetched | ファイル数 |" と
    // セパレータ "|---|---|---|---|" は date 列の正規表現に一致しないので弾かれる
    const bad = [
      '# Docs',
      '',
      '| ソース | パッケージ | Last Fetched | ファイル数 |',
      '|-------|----------|-------------|---------|',
      '| not | enough |',
    ].join('\n');
    expect(parseManifest(bad)).toEqual([]);
  });
});

describe('writeManifest', () => {
  it('writes MANIFEST.md for fetched sources and skips un-fetched', async () => {
    await withTmp(async (root) => {
      const bun = join(root, '.shirokuma', 'contexts', 'bun');
      mkdirSync(bun, { recursive: true });
      writeFileSync(join(bun, 'a.md'), '');
      writeFileSync(join(bun, '.last-fetched'), '2026-04-19T10:00:00.000Z');
      mkdirSync(join(root, '.shirokuma', 'contexts', 'unfetched'));

      await writeManifest({
        projectPath: root,
        sources: [{ name: 'bun' }, { name: 'unfetched' }],
      });

      const manifestPath = join(root, '.shirokuma', 'contexts', 'MANIFEST.md');
      const content = readFileSync(manifestPath, 'utf-8');
      expect(content).toContain('| bun | bun | 2026-04-19 | 1 |');
      expect(content).not.toContain('| unfetched |');
    });
  });

  it('invokes resolvePackageName to resolve package column', async () => {
    await withTmp(async (root) => {
      const bun = join(root, '.shirokuma', 'contexts', 'bun');
      mkdirSync(bun, { recursive: true });
      writeFileSync(join(bun, 'a.md'), '');
      writeFileSync(join(bun, '.last-fetched'), '2026-04-19T10:00:00.000Z');

      await writeManifest({
        projectPath: root,
        sources: [{ name: 'bun' }],
        resolvePackageName: async (name) => `${name}-types`,
      });

      const content = readFileSync(join(root, '.shirokuma', 'contexts', 'MANIFEST.md'), 'utf-8');
      expect(content).toContain('| bun | bun-types | 2026-04-19 | 1 |');
    });
  });

  it('preserves legacy entries when their outputDir still exists on disk', async () => {
    await withTmp(async (root) => {
      const docsRoot = join(root, '.shirokuma', 'contexts');
      const legacy = join(docsRoot, 'legacy');
      mkdirSync(legacy, { recursive: true });
      writeFileSync(join(legacy, 'a.md'), 'x'); // legacy dir 実在
      writeFileSync(
        join(docsRoot, 'MANIFEST.md'),
        formatManifest([
          { source: 'legacy', package: 'legacy', lastFetched: '2026-03-01', fileCount: 5 },
        ]),
      );
      const bun = join(docsRoot, 'bun');
      mkdirSync(bun);
      writeFileSync(join(bun, 'a.md'), '');
      writeFileSync(join(bun, '.last-fetched'), '2026-04-19T10:00:00.000Z');

      await writeManifest({ projectPath: root, sources: [{ name: 'bun' }] });

      const content = readFileSync(join(docsRoot, 'MANIFEST.md'), 'utf-8');
      expect(content).toContain('| bun | bun |');
      expect(content).toContain('| legacy | legacy | 2026-03-01 | 5 |');
    });
  });

  it('evicts legacy entries when their outputDir no longer exists', async () => {
    await withTmp(async (root) => {
      const docsRoot = join(root, '.shirokuma', 'contexts');
      mkdirSync(docsRoot, { recursive: true });
      writeFileSync(
        join(docsRoot, 'MANIFEST.md'),
        formatManifest([
          { source: 'stale', package: 'stale', lastFetched: '2026-03-01', fileCount: 5 },
        ]),
      );
      const bun = join(docsRoot, 'bun');
      mkdirSync(bun);
      writeFileSync(join(bun, 'a.md'), '');
      writeFileSync(join(bun, '.last-fetched'), '2026-04-19T10:00:00.000Z');

      await writeManifest({ projectPath: root, sources: [{ name: 'bun' }] });

      const content = readFileSync(join(docsRoot, 'MANIFEST.md'), 'utf-8');
      expect(content).toContain('| bun | bun |');
      expect(content).not.toContain('| stale |');
    });
  });
});

describe('removeManifestEntry', () => {
  it('drops the matching entry and rewrites MANIFEST.md', async () => {
    await withTmp(async (root) => {
      const docsRoot = join(root, '.shirokuma', 'contexts');
      mkdirSync(docsRoot, { recursive: true });
      writeFileSync(join(docsRoot, 'MANIFEST.md'), formatManifest(SAMPLE_ENTRIES));

      removeManifestEntry(root, 'bun');

      const content = readFileSync(join(docsRoot, 'MANIFEST.md'), 'utf-8');
      expect(content).not.toContain('| bun |');
      expect(content).toContain('| astro |');
    });
  });

  it('is a no-op when manifest is missing or entry absent', async () => {
    await withTmp((root) => {
      removeManifestEntry(root, 'bun'); // no file — no throw
      expect(existsSync(join(root, '.shirokuma/contexts/MANIFEST.md'))).toBe(false);
    });
  });
});
