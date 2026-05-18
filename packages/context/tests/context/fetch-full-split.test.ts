import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchFullSplit } from '../../src/context/fetch-full-split.js';
import { createEmptyStats } from '../../src/context/stats.js';
import type { FullSplitStrategyMeta } from '../../src/context/types.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-fullsplit-'));
  return Promise.resolve(run(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

function mockFetch(body: string, status = 200): void {
  globalThis.fetch = vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
}

const BASE_META: FullSplitStrategyMeta = {
  fetchStrategy: 'full-split',
  url: 'https://example.com/llms.txt',
  fullUrl: 'https://example.com/llms-full.txt',
  splitPattern: '^# ',
  sectionFormatter: 'passthrough',
};

describe('fetchFullSplit', () => {
  it('splits llms-full.txt into sections and writes each as {slug}.md', async () => {
    await withTmp(async (dir) => {
      const full = '# Intro\nintro body\n\n# Getting Started\ngs body\n';
      mockFetch(full);
      const stats = await fetchFullSplit({
        src: { name: 'demo' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        llmsContent: '',
        meta: BASE_META,
      });
      expect(stats.downloaded).toBe(2);
      expect(readdirSync(dir).sort()).toEqual(['.last-fetched', 'getting-started.md', 'intro.md']);
      expect(readFileSync(join(dir, 'intro.md'), 'utf-8')).toContain('intro body');
    });
  });

  it('preserves content before the first match as a pre-section', async () => {
    await withTmp(async (dir) => {
      const full = 'preamble line\n\n# First\nbody';
      mockFetch(full);
      await fetchFullSplit({
        src: { name: 'demo' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        llmsContent: '',
        meta: BASE_META,
      });
      const files = readdirSync(dir).filter((f) => !f.startsWith('.'));
      expect(files).toHaveLength(2);
      expect(files.some((f) => f.startsWith('preamble'))).toBe(true);
    });
  });

  it('errors when fullUrl is missing and meta has none', async () => {
    await withTmp(async (dir) => {
      const stats = await fetchFullSplit({
        src: { name: 'demo' },
        outDir: dir,
        options: {},
        stats: createEmptyStats(),
        llmsContent: '',
        meta: { ...BASE_META, fullUrl: undefined as unknown as string },
      });
      expect(stats.downloaded).toBe(0);
    });
  });

  it('errors when splitPattern is invalid regex', async () => {
    await withTmp(async (dir) => {
      mockFetch('# a\n');
      const stats = await fetchFullSplit({
        src: { name: 'demo' },
        outDir: dir,
        options: {},
        stats: createEmptyStats(),
        llmsContent: '',
        meta: { ...BASE_META, splitPattern: '[unclosed' },
      });
      expect(stats.downloaded).toBe(0);
    });
  });

  it('counts existing files as skipped without --force', async () => {
    await withTmp(async (dir) => {
      mockFetch('# A\nbody\n# B\nbody2');
      // 1 回目: 両方 download
      await fetchFullSplit({
        src: { name: 'demo' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        llmsContent: '',
        meta: BASE_META,
      });
      // 2 回目: --force なしなら全部 skip
      const stats = await fetchFullSplit({
        src: { name: 'demo' },
        outDir: dir,
        options: {},
        stats: createEmptyStats(),
        llmsContent: '',
        meta: BASE_META,
      });
      expect(stats.skipped).toBe(2);
      expect(stats.downloaded).toBe(0);
    });
  });

  it('adds -N suffix when section filenames would collide', async () => {
    await withTmp(async (dir) => {
      // 2 セクションとも `# Intro` から始まる → slug がぶつかる
      const full = '# Intro\nfirst body\n\n# Intro\nsecond body\n';
      mockFetch(full);
      await fetchFullSplit({
        src: { name: 'demo' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        llmsContent: '',
        meta: BASE_META,
      });
      const files = readdirSync(dir)
        .filter((f) => !f.startsWith('.'))
        .sort();
      expect(files).toEqual(['intro-2.md', 'intro.md']);
    });
  });

  it('applies metadata-to-frontmatter formatter when configured', async () => {
    await withTmp(async (dir) => {
      const full = 'Source: https://example.com/p\n\nbody';
      mockFetch(full);
      await fetchFullSplit({
        src: { name: 'demo' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        llmsContent: '[Title](https://example.com/p)',
        meta: {
          ...BASE_META,
          splitPattern: '^Source: ',
          sectionFormatter: 'metadata-to-frontmatter',
        },
      });
      const files = readdirSync(dir).filter((f) => !f.startsWith('.'));
      expect(files).toHaveLength(1);
      const file = files[0];
      if (!file) throw new Error('expected one output file');
      const content = readFileSync(join(dir, file), 'utf-8');
      expect(content).toMatch(/^---\ntitle: "Title"\nsource: https:\/\/example\.com\/p\n---/);
    });
  });
});
