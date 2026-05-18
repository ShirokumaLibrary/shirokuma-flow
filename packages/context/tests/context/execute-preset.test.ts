import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executePreset, loadPresetExecutor } from '../../src/context/execute-preset.js';
import { createEmptyStats } from '../../src/context/stats.js';
import { NOOP_LOGGER } from '../../src/context/logger.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function withTmp<T>(run: (rootDir: string, outDir: string) => Promise<T> | T): Promise<T> {
  const root = mkdtempSync(join(tmpdir(), 'context-exec-'));
  const outDir = join(root, 'bun');
  mkdirSync(outDir, { recursive: true });
  return Promise.resolve(run(root, outDir)).finally(() =>
    rmSync(root, { recursive: true, force: true }),
  );
}

describe('loadPresetExecutor', () => {
  it('returns null for unknown preset names', () => {
    expect(loadPresetExecutor('does-not-exist')).toBeNull();
  });

  it('loads bun-1 executor', () => {
    expect(typeof loadPresetExecutor('bun-1')).toBe('function');
  });
});

describe('executePreset — bun-1 (individual)', () => {
  it('fetches llms.txt then individual .md links and writes them flattened', async () => {
    await withTmp(async (root, outDir) => {
      const llmsContent = [
        '[Guide](https://bun.com/docs/a.md)',
        '[Other](https://bun.com/docs/b.md)',
      ].join('\n');
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === 'https://bun.com/docs/llms.txt') {
          return new Response(llmsContent, { status: 200 });
        }
        if (url.endsWith('.md')) {
          if (init?.method === 'HEAD') return new Response(null, { status: 200 });
          return new Response('# page', { status: 200 });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }) as unknown as typeof fetch;

      const stats = await executePreset('bun-1', {
        src: { name: 'bun' },
        outDir,
        options: { force: true, images: false },
        stats: createEmptyStats(),
        logger: NOOP_LOGGER,
      });
      expect(stats.downloaded).toBe(2);
      expect(existsSync(join(outDir, 'a.md'))).toBe(true);
      expect(existsSync(join(outDir, 'b.md'))).toBe(true);
      expect(existsSync(join(root, 'bun-llms.txt'))).toBe(true);
    });
  });
});

describe('executePreset — drizzle-0 (full-split)', () => {
  it('splits llms-full.txt with metadata-to-frontmatter formatter', async () => {
    await withTmp(async (_root, outDir) => {
      const full = [
        'Source: https://orm.drizzle.team/a',
        'body of a',
        '',
        'Source: https://orm.drizzle.team/b',
        'body of b',
      ].join('\n');
      const llmsContent = [
        '[A](https://orm.drizzle.team/a)',
        '[B](https://orm.drizzle.team/b)',
      ].join('\n');
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === 'https://orm.drizzle.team/llms.txt') {
          return new Response(llmsContent, { status: 200 });
        }
        if (url === 'https://orm.drizzle.team/llms-full.txt') {
          return new Response(full, { status: 200 });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }) as unknown as typeof fetch;

      const stats = await executePreset('drizzle-0', {
        src: { name: 'drizzle' },
        outDir,
        options: { force: true, images: false },
        stats: createEmptyStats(),
        logger: NOOP_LOGGER,
      });
      expect(stats.downloaded).toBe(2);
      const files = readdirSync(outDir)
        .filter((f) => !f.startsWith('.'))
        .sort();
      expect(files).toHaveLength(2);
      const first = readFileSync(join(outDir, files[0] ?? ''), 'utf-8');
      expect(first).toMatch(/^---\ntitle: "A"\nsource: https:\/\/orm\.drizzle\.team\/a\n---/);
    });
  });
});

describe('executePreset — laravel-11 (github-tree)', () => {
  it('downloads .md files from GitHub tree', async () => {
    await withTmp(async (_root, outDir) => {
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.startsWith('https://api.github.com/')) {
          return new Response(
            JSON.stringify({
              tree: [
                { path: 'intro.md', type: 'blob' },
                { path: 'installation.md', type: 'blob' },
                { path: 'image.png', type: 'blob' },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (url.startsWith('https://raw.githubusercontent.com/')) {
          if (init?.method === 'HEAD') return new Response(null, { status: 200 });
          return new Response('# page', { status: 200 });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }) as unknown as typeof fetch;

      const stats = await executePreset('laravel-11', {
        src: { name: 'laravel', url: 'https://github.com/laravel/docs' },
        outDir,
        options: { force: true, images: false },
        stats: createEmptyStats(),
        logger: NOOP_LOGGER,
      });
      expect(stats.downloaded).toBe(2);
      expect(existsSync(join(outDir, 'intro.md'))).toBe(true);
      expect(existsSync(join(outDir, 'installation.md'))).toBe(true);
    });
  });
});

describe('executePreset — aws-cli-2 (dryRun)', () => {
  it('fetches llms.txt and reports the section-based page plan without writing', async () => {
    const originalFetch = globalThis.fetch;
    try {
      const llms = [
        '## [Get started](https://docs.aws.amazon.com/cli/latest/userguide/getting-started.html)',
        '- [Install](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html): install CLI',
        '- [Quickstart](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-quickstart.html)',
      ].join('\n');
      globalThis.fetch = vi.fn(
        async () => new Response(llms, { status: 200 }),
      ) as unknown as typeof fetch;

      await withTmp(async (_root, outDir) => {
        const infos: string[] = [];
        const stats = await executePreset('aws-cli-2', {
          src: { name: 'aws-cli' },
          outDir,
          options: { dryRun: true },
          stats: createEmptyStats(),
          logger: {
            info: (m) => infos.push(m),
            warn: () => {},
            error: () => {},
          },
        });
        expect(stats.downloaded).toBe(0);
        expect(infos.some((m) => m.includes('Install'))).toBe(true);
        expect(infos.some((m) => m.includes('Quickstart'))).toBe(true);
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('executePreset — unknown name', () => {
  it('returns stats unchanged and emits error log', async () => {
    const errors: string[] = [];
    const stats = await executePreset('does-not-exist', {
      src: { name: 'x' },
      outDir: '/tmp/unused',
      options: {},
      stats: createEmptyStats(),
      logger: {
        info: () => {},
        warn: () => {},
        error: (m) => errors.push(m),
      },
    });
    expect(stats.downloaded).toBe(0);
    expect(errors.some((m) => m.includes('execute が見つかりません'))).toBe(true);
  });
});
