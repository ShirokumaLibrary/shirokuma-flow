import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execute } from '../../src/context/presets/typescript-5.js';
import { createEmptyStats } from '../../src/context/stats.js';
import { NOOP_LOGGER } from '../../src/context/logger.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-ts5-'));
  return Promise.resolve(run(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

const TREE = {
  tree: [
    { path: 'packages/documentation/copy/en/intro.md', type: 'blob' },
    { path: 'packages/documentation/copy/en/handbook/basic.md', type: 'blob' },
    { path: 'packages/documentation/copy/ja/intro.md', type: 'blob' },
    { path: 'packages/tsconfig-reference/copy/en/target.md', type: 'blob' },
    { path: 'packages/glossary/copy/en/term.md', type: 'blob' },
    { path: 'packages/other/not-a-doc.ts', type: 'blob' },
  ],
};

describe('typescript-5 preset', () => {
  it('downloads each doc package into its own subdir and skips other languages', async () => {
    await withTmp(async (dir) => {
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.startsWith('https://api.github.com/')) {
          return new Response(JSON.stringify(TREE), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.startsWith('https://raw.githubusercontent.com/')) {
          return new Response('# page', { status: 200 });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }) as unknown as typeof fetch;

      const stats = await execute({
        src: { name: 'typescript', url: 'https://github.com/microsoft/TypeScript-Website' },
        outDir: dir,
        options: { force: true, images: false },
        stats: createEmptyStats(),
        logger: NOOP_LOGGER,
      });

      expect(stats.downloaded).toBe(4);
      expect(existsSync(join(dir, 'documentation', 'intro.md'))).toBe(true);
      expect(existsSync(join(dir, 'documentation', 'handbook', 'basic.md'))).toBe(true);
      expect(existsSync(join(dir, 'tsconfig-reference', 'target.md'))).toBe(true);
      expect(existsSync(join(dir, 'glossary', 'term.md'))).toBe(true);
      // other/ や copy/ja/ は取得しない
      expect(existsSync(join(dir, 'other'))).toBe(false);
    });
  });

  it('errors when url is not a GitHub repo', async () => {
    await withTmp(async (dir) => {
      const stats = await execute({
        src: { name: 'typescript', url: 'https://example.com/not-github' },
        outDir: dir,
        options: {},
        stats: createEmptyStats(),
        logger: NOOP_LOGGER,
      });
      expect(stats.downloaded).toBe(0);
    });
  });

  it('dryRun skips writes', async () => {
    await withTmp(async (dir) => {
      globalThis.fetch = vi.fn(
        async () =>
          new Response(JSON.stringify({ tree: [TREE.tree[0]] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ) as unknown as typeof fetch;

      const stats = await execute({
        src: { name: 'typescript', url: 'https://github.com/microsoft/TypeScript-Website' },
        outDir: dir,
        options: { dryRun: true },
        stats: createEmptyStats(),
        logger: NOOP_LOGGER,
      });
      expect(stats.downloaded).toBe(0);
    });
  });

  it('skips existing files without --force', async () => {
    await withTmp(async (dir) => {
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.startsWith('https://api.github.com/')) {
          return new Response(JSON.stringify({ tree: [TREE.tree[0]] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        throw new Error('raw fetch should not run when file exists and force=false');
      }) as unknown as typeof fetch;

      // pre-populate target
      const target = join(dir, 'documentation', 'intro.md');
      const { mkdirSync, writeFileSync } = await import('node:fs');
      mkdirSync(join(dir, 'documentation'), { recursive: true });
      writeFileSync(target, 'existing');

      const stats = await execute({
        src: { name: 'typescript', url: 'https://github.com/microsoft/TypeScript-Website' },
        outDir: dir,
        options: { force: false, images: false },
        stats: createEmptyStats(),
        logger: NOOP_LOGGER,
      });
      expect(stats.skipped).toBe(1);
      expect(stats.downloaded).toBe(0);
    });
  });
});
