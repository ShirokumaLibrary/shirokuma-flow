import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  collectMarkdownFiles,
  countMarkdownFiles,
  discoverFilesystemSources,
  readLastFetched,
  resolveOutputDir,
} from '../../src/context/fs-helpers.js';

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-fs-'));
  return Promise.resolve(run(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

describe('resolveOutputDir', () => {
  it('returns absolute sourceOutputDir as-is', () => {
    const out = resolveOutputDir({
      projectPath: '/proj',
      sourceName: 'a',
      sourceOutputDir: '/abs/custom',
    });
    expect(out).toBe('/abs/custom');
  });

  it('resolves relative sourceOutputDir against projectPath', () => {
    const out = resolveOutputDir({
      projectPath: '/proj',
      sourceName: 'a',
      sourceOutputDir: 'custom/path',
    });
    expect(out).toBe('/proj/custom/path');
  });

  it('falls back to docsRoot/sourceName', () => {
    const out = resolveOutputDir({
      projectPath: '/proj',
      sourceName: 'a',
      docsRoot: 'docs',
    });
    expect(out).toBe('/proj/docs/a');
  });

  it('falls back to .shirokuma/contexts/sourceName when docsRoot is omitted', () => {
    const out = resolveOutputDir({ projectPath: '/proj', sourceName: 'a' });
    expect(out).toBe('/proj/.shirokuma/contexts/a');
  });
});

describe('discoverFilesystemSources', () => {
  it('lists immediate subdirectories and skips dotfiles', async () => {
    await withTmp(async (root) => {
      const docsDir = join(root, '.shirokuma', 'contexts');
      mkdirSync(join(docsDir, 'bun'), { recursive: true });
      mkdirSync(join(docsDir, 'vue'));
      mkdirSync(join(docsDir, '.cache'));
      const sources = discoverFilesystemSources(root);
      expect(sources.map((s) => s.name).sort()).toEqual(['bun', 'vue']);
    });
  });

  it('returns [] when docs root does not exist', async () => {
    await withTmp((root) => {
      expect(discoverFilesystemSources(root)).toEqual([]);
    });
  });
});

describe('countMarkdownFiles', () => {
  it('recursively counts .md and .adoc while skipping dotfiles', async () => {
    await withTmp(async (root) => {
      mkdirSync(join(root, 'sub'));
      writeFileSync(join(root, 'a.md'), '');
      writeFileSync(join(root, 'b.adoc'), '');
      writeFileSync(join(root, 'c.txt'), '');
      writeFileSync(join(root, '.hidden.md'), '');
      writeFileSync(join(root, 'sub', 'd.md'), '');
      expect(countMarkdownFiles(root)).toBe(3);
    });
  });

  it('returns 0 for non-existent dir', () => {
    expect(countMarkdownFiles('/tmp/does-not-exist-ctx-fs-xyz')).toBe(0);
  });
});

describe('collectMarkdownFiles', () => {
  it('collects .md and .txt (not .adoc) recursively', async () => {
    await withTmp(async (root) => {
      mkdirSync(join(root, 'sub'));
      writeFileSync(join(root, 'a.md'), '');
      writeFileSync(join(root, 'b.adoc'), '');
      writeFileSync(join(root, 'c.txt'), '');
      writeFileSync(join(root, 'sub', 'd.md'), '');
      const files = collectMarkdownFiles(root)
        .map((p) => p.slice(root.length + 1))
        .sort();
      expect(files).toEqual(['a.md', 'c.txt', 'sub/d.md']);
    });
  });
});

describe('readLastFetched', () => {
  it('returns iso + date when .last-fetched is valid', async () => {
    await withTmp(async (root) => {
      writeFileSync(join(root, '.last-fetched'), '2026-04-19T10:30:00.000Z');
      expect(readLastFetched(root)).toEqual({
        iso: '2026-04-19T10:30:00.000Z',
        date: '2026-04-19',
      });
    });
  });

  it('returns null when missing or invalid', async () => {
    await withTmp((root) => {
      expect(readLastFetched(root)).toBeNull();
      writeFileSync(join(root, '.last-fetched'), 'not-a-date');
      expect(readLastFetched(root)).toBeNull();
    });
  });
});
