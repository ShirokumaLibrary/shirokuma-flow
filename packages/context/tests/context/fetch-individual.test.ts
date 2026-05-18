import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchIndividual } from '../../src/context/fetch-individual.js';
import { createEmptyStats } from '../../src/context/stats.js';
import type { IndividualStrategyMeta } from '../../src/context/types.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-individual-'));
  return Promise.resolve(run(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response): void {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(typeof input === 'string' ? input : input.toString(), init),
  ) as unknown as typeof fetch;
}

const META: IndividualStrategyMeta = {
  fetchStrategy: 'individual',
  url: 'https://example.com/llms.txt',
};

describe('fetchIndividual', () => {
  it('fetches same-domain .md links and writes each file', async () => {
    await withTmp(async (dir) => {
      mockFetch((_url, init) => {
        if (init?.method === 'HEAD') return new Response(null, { status: 200 });
        return new Response('# content', { status: 200 });
      });
      const llms = `
[A](https://example.com/a.md)
[B](https://example.com/b.md)
[Other](https://elsewhere.com/x.md)
      `;
      const stats = await fetchIndividual({
        src: { name: 'demo', url: 'https://example.com/llms.txt' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        llmsContent: llms,
        meta: META,
      });
      expect(stats.downloaded).toBe(2);
      expect(readdirSync(dir).sort()).toEqual(['.last-fetched', 'a.md', 'b.md']);
      expect(readFileSync(join(dir, 'a.md'), 'utf-8')).toBe('# content');
    });
  });

  it('errors when src.url is missing', async () => {
    await withTmp(async (dir) => {
      const stats = await fetchIndividual({
        src: { name: 'demo' },
        outDir: dir,
        options: {},
        stats: createEmptyStats(),
        llmsContent: '',
        meta: META,
      });
      expect(stats).toEqual(createEmptyStats());
    });
  });

  it('respects linkFormat=clean by appending .md to extensionless URLs', async () => {
    await withTmp(async (dir) => {
      mockFetch(() => new Response('md', { status: 200 }));
      const llms = '[Guide](https://example.com/docs/guide/)';
      const stats = await fetchIndividual({
        src: { name: 'demo', url: 'https://example.com/llms.txt', linkFormat: 'clean' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        llmsContent: llms,
        meta: META,
      });
      expect(stats.downloaded).toBe(1);
      expect(existsSync(join(dir, 'guide.md'))).toBe(true);
    });
  });

  it('dryRun skips writes', async () => {
    await withTmp(async (dir) => {
      mockFetch(() => {
        throw new Error('should not be called in dry run');
      });
      const llms = '[A](https://example.com/a.md)';
      const stats = await fetchIndividual({
        src: { name: 'demo', url: 'https://example.com/llms.txt' },
        outDir: dir,
        options: { dryRun: true },
        stats: createEmptyStats(),
        llmsContent: llms,
        meta: META,
      });
      expect(stats.downloaded).toBe(0);
      expect(existsSync(dir)).toBe(true);
    });
  });

  it('applies stripHeaderPattern and stripLinePattern to downloaded files', async () => {
    await withTmp(async (dir) => {
      const body = '> note line\n> another\n\n# Title\nkeep this\ndrop: noise';
      mockFetch(() => new Response(body, { status: 200 }));
      const meta: IndividualStrategyMeta = {
        fetchStrategy: 'individual',
        url: 'https://example.com/llms.txt',
        stripHeaderPattern: '^(>\\s.*\\n)+\\n?',
        stripLinePattern: '^drop:',
      };
      await fetchIndividual({
        src: { name: 'demo', url: 'https://example.com/llms.txt' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        llmsContent: '[A](https://example.com/a.md)',
        meta,
      });
      const content = readFileSync(join(dir, 'a.md'), 'utf-8');
      expect(content.startsWith('# Title')).toBe(true);
      expect(content).not.toContain('drop: noise');
    });
  });

  it('filters out non-.md links when linkFormat=md', async () => {
    await withTmp(async (dir) => {
      mockFetch(() => new Response('ok', { status: 200 }));
      const llms = `
[Keep](https://example.com/a.md)
[Html](https://example.com/guide.html)
[Txt](https://example.com/notes.txt.md)
      `;
      const stats = await fetchIndividual({
        src: { name: 'demo', url: 'https://example.com/llms.txt' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        llmsContent: llms,
        meta: META,
      });
      // `.txt.md` は除外、`.html` も除外 → a.md のみ
      expect(stats.downloaded).toBe(1);
      expect(readdirSync(dir).filter((f) => f.endsWith('.md'))).toEqual(['a.md']);
    });
  });

  it('treats same-domain regardless of port (hostname-based match)', async () => {
    await withTmp(async (dir) => {
      mockFetch(() => new Response('ok', { status: 200 }));
      const llms = '[P](https://example.com:8080/a.md)';
      const stats = await fetchIndividual({
        src: { name: 'demo', url: 'https://example.com/llms.txt' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        llmsContent: llms,
        meta: META,
      });
      expect(stats.downloaded).toBe(1);
    });
  });

  it('counts failed fetches', async () => {
    await withTmp(async (dir) => {
      mockFetch(() => new Response('', { status: 500 }));
      const stats = await fetchIndividual({
        src: { name: 'demo', url: 'https://example.com/llms.txt' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        llmsContent: '[A](https://example.com/a.md)',
        meta: META,
      });
      expect(stats.failed).toBe(1);
      expect(stats.downloaded).toBe(0);
    });
  });
});
