import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchAndSaveLlmsTxt } from '../../src/context/fetch-markdown.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(handler: () => Response): void {
  globalThis.fetch = vi.fn(async () => handler()) as unknown as typeof fetch;
}

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-llms-'));
  return Promise.resolve(run(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

describe('fetchAndSaveLlmsTxt', () => {
  it('writes {sourceName}-llms.txt to the docsRoot and returns content', async () => {
    await withTmp(async (dir) => {
      mockFetch(() => new Response('# llms', { status: 200 }));
      const out = await fetchAndSaveLlmsTxt('react-19', 'https://x/llms.txt', dir, false);
      expect(out).toBe('# llms');
      expect(readFileSync(join(dir, 'react-19-llms.txt'), 'utf-8')).toBe('# llms');
    });
  });

  it('creates docsRoot if missing', async () => {
    await withTmp(async (parent) => {
      const nested = join(parent, 'nested', 'docs');
      mockFetch(() => new Response('x', { status: 200 }));
      await fetchAndSaveLlmsTxt('foo', 'https://x', nested, false);
      expect(existsSync(join(nested, 'foo-llms.txt'))).toBe(true);
    });
  });

  it('dryRun=true returns content without writing', async () => {
    await withTmp(async (dir) => {
      mockFetch(() => new Response('content', { status: 200 }));
      const out = await fetchAndSaveLlmsTxt('foo', 'https://x', dir, true);
      expect(out).toBe('content');
      expect(existsSync(join(dir, 'foo-llms.txt'))).toBe(false);
    });
  });

  it('throws on non-2xx', async () => {
    await withTmp(async (dir) => {
      mockFetch(() => new Response('not found', { status: 404 }));
      await expect(fetchAndSaveLlmsTxt('foo', 'https://x', dir, false)).rejects.toThrow(/404/);
    });
  });

  it('propagates network errors (fetch rejects)', async () => {
    await withTmp(async (dir) => {
      globalThis.fetch = vi.fn(async () => {
        throw new Error('ENOTFOUND');
      }) as unknown as typeof fetch;
      await expect(fetchAndSaveLlmsTxt('foo', 'https://x', dir, false)).rejects.toThrow(
        /ENOTFOUND/,
      );
    });
  });
});
