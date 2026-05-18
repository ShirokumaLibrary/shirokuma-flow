import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchMarkdown, writeLastFetched } from '../../src/context/fetch-markdown.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-fetch-'));
  return Promise.resolve(run(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(typeof input === 'string' ? input : input.toString(), init),
  );
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

describe('fetchMarkdown', () => {
  it('downloads and writes the file when no local copy exists', async () => {
    await withTmp(async (dir) => {
      const out = join(dir, 'a.md');
      mockFetch(() => new Response('# hello', { status: 200 }));
      expect(await fetchMarkdown('https://x/a.md', out, false)).toBe('downloaded');
      expect(readFileSync(out, 'utf-8')).toBe('# hello');
    });
  });

  it('returns "failed" on non-2xx GET', async () => {
    await withTmp(async (dir) => {
      const out = join(dir, 'a.md');
      mockFetch(() => new Response('', { status: 500 }));
      expect(await fetchMarkdown('https://x/a.md', out, false)).toBe('failed');
    });
  });

  it('returns "failed" when fetch throws', async () => {
    await withTmp(async (dir) => {
      const out = join(dir, 'a.md');
      mockFetch(() => {
        throw new Error('network down');
      });
      expect(await fetchMarkdown('https://x/a.md', out, false)).toBe('failed');
    });
  });

  it('skips when remote Last-Modified is older than local mtime', async () => {
    await withTmp(async (dir) => {
      const out = join(dir, 'a.md');
      writeFileSync(out, 'old');
      utimesSync(out, new Date('2030-01-01'), new Date('2030-01-01'));

      const spy = mockFetch((_url, init) => {
        if (init?.method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: { 'last-modified': new Date('2025-01-01').toUTCString() },
          });
        }
        throw new Error('GET should not be called');
      });
      expect(await fetchMarkdown('https://x/a.md', out, false)).toBe('skipped');
      // 1 HEAD call, no GET
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  it('re-downloads when remote Last-Modified is newer', async () => {
    await withTmp(async (dir) => {
      const out = join(dir, 'a.md');
      writeFileSync(out, 'old');
      utimesSync(out, new Date('2020-01-01'), new Date('2020-01-01'));

      mockFetch((_url, init) => {
        if (init?.method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: { 'last-modified': new Date('2030-01-01').toUTCString() },
          });
        }
        return new Response('new', { status: 200 });
      });
      expect(await fetchMarkdown('https://x/a.md', out, false)).toBe('downloaded');
      expect(readFileSync(out, 'utf-8')).toBe('new');
    });
  });

  it('skips when HEAD has no Last-Modified header', async () => {
    await withTmp(async (dir) => {
      const out = join(dir, 'a.md');
      writeFileSync(out, 'old');
      mockFetch(() => new Response(null, { status: 200 }));
      expect(await fetchMarkdown('https://x/a.md', out, false)).toBe('skipped');
    });
  });

  it('force=true always re-downloads even if file exists', async () => {
    await withTmp(async (dir) => {
      const out = join(dir, 'a.md');
      writeFileSync(out, 'old');
      const spy = mockFetch(() => new Response('new', { status: 200 }));
      expect(await fetchMarkdown('https://x/a.md', out, true)).toBe('downloaded');
      expect(readFileSync(out, 'utf-8')).toBe('new');
      // no HEAD, only GET
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('writeLastFetched', () => {
  it('writes an ISO timestamp to .last-fetched', async () => {
    await withTmp((dir) => {
      writeLastFetched(dir);
      const content = readFileSync(join(dir, '.last-fetched'), 'utf-8');
      expect(content).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
