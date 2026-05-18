import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execute } from '../../src/context/presets/tailwindcss-4.js';
import { createEmptyStats } from '../../src/context/stats.js';
import { NOOP_LOGGER } from '../../src/context/logger.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-tw4-'));
  return Promise.resolve(run(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

describe('tailwindcss-4 preset', () => {
  it('downloads .md + .mdx from src/docs and converts .mdx to .md in place', async () => {
    await withTmp(async (dir) => {
      const tree = {
        tree: [
          { path: 'src/docs/intro.md', type: 'blob' },
          { path: 'src/docs/utilities.mdx', type: 'blob' },
          { path: 'src/other/skip.mdx', type: 'blob' },
        ],
      };
      const mdxContent = ['export const title = "Utilities";', '', '# Utilities', '', 'body.'].join(
        '\n',
      );

      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.startsWith('https://api.github.com/')) {
          return new Response(JSON.stringify(tree), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.endsWith('utilities.mdx')) {
          return new Response(mdxContent, { status: 200 });
        }
        if (url.startsWith('https://raw.githubusercontent.com/')) {
          return new Response('# md page', { status: 200 });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }) as unknown as typeof fetch;

      const stats = await execute({
        src: { name: 'tailwindcss', url: 'https://github.com/tailwindlabs/tailwindcss.com' },
        outDir: dir,
        options: { force: true, images: false },
        stats: createEmptyStats(),
        logger: NOOP_LOGGER,
      });

      expect(stats.downloaded).toBe(2);
      expect(existsSync(join(dir, 'intro.md'))).toBe(true);
      // .mdx は .md に置換済み、元 .mdx は削除
      expect(existsSync(join(dir, 'utilities.md'))).toBe(true);
      expect(existsSync(join(dir, 'utilities.mdx'))).toBe(false);

      const md = readFileSync(join(dir, 'utilities.md'), 'utf-8');
      expect(md).toMatch(/^---\ntitle: "Utilities"\n---/);
      expect(md).toContain('body.');
    });
  });

  it('skips conversion when dryRun is set', async () => {
    await withTmp(async (dir) => {
      globalThis.fetch = vi.fn(
        async () =>
          new Response(JSON.stringify({ tree: [{ path: 'src/docs/a.mdx', type: 'blob' }] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ) as unknown as typeof fetch;

      const stats = await execute({
        src: { name: 'tw', url: 'https://github.com/tailwindlabs/tailwindcss.com' },
        outDir: dir,
        options: { dryRun: true },
        stats: createEmptyStats(),
        logger: NOOP_LOGGER,
      });
      expect(stats.downloaded).toBe(0);
      expect(existsSync(join(dir, 'a.md'))).toBe(false);
      expect(existsSync(join(dir, 'a.mdx'))).toBe(false);
    });
  });
});
