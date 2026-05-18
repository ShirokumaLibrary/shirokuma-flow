import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchGithubTree } from '../../src/context/fetch-github-tree.js';
import { createEmptyStats } from '../../src/context/stats.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-github-tree-'));
  return Promise.resolve(run(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

interface TreeItem {
  path: string;
  type: string;
  sha?: string;
}

function mockFetchForTree(options: {
  tree?: TreeItem[];
  content?: string;
  headStatus?: number;
  contentStatus?: number;
}): void {
  const tree = options.tree ?? [];
  const content = options.content ?? '# content';
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.startsWith('https://api.github.com/')) {
      return new Response(JSON.stringify({ tree }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.startsWith('https://raw.githubusercontent.com/')) {
      if (init?.method === 'HEAD') {
        return new Response(null, { status: options.headStatus ?? 200 });
      }
      return new Response(content, { status: options.contentStatus ?? 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

describe('fetchGithubTree', () => {
  it('downloads .md files under repoPath and writes them flattened', async () => {
    await withTmp(async (dir) => {
      mockFetchForTree({
        tree: [
          { path: 'docs/intro.md', type: 'blob' },
          { path: 'docs/guide/start.md', type: 'blob' },
          { path: 'src/index.ts', type: 'blob' },
          { path: 'docs', type: 'tree' },
        ],
      });
      const stats = await fetchGithubTree({
        src: { name: 'acme', url: 'https://github.com/acme/docs', repoPath: 'docs' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        presetName: 'acme-1',
        defaultBranch: 'main',
      });
      expect(stats.downloaded).toBe(2);
      expect(existsSync(join(dir, 'intro.md'))).toBe(true);
      expect(existsSync(join(dir, 'guide', 'start.md'))).toBe(true);
      expect(readFileSync(join(dir, 'intro.md'), 'utf-8')).toBe('# content');
    });
  });

  it('errors when src.url is not a GitHub repo URL', async () => {
    await withTmp(async (dir) => {
      const stats = await fetchGithubTree({
        src: { name: 'bad', url: 'https://example.com/not-github' },
        outDir: dir,
        options: {},
        stats: createEmptyStats(),
        presetName: 'bad-1',
        defaultBranch: 'main',
      });
      expect(stats.downloaded).toBe(0);
      expect(existsSync(dir)).toBe(true);
    });
  });

  it('filters by fileExtensions and supports .adoc', async () => {
    await withTmp(async (dir) => {
      mockFetchForTree({
        tree: [
          { path: 'v2/guide/intro.adoc', type: 'blob' },
          { path: 'v2/guide/book.adoc', type: 'blob' },
          { path: 'v2/guide/readme.md', type: 'blob' },
        ],
      });
      const stats = await fetchGithubTree({
        src: { name: 'aws', url: 'https://github.com/awsdocs/aws-cdk-guide', repoPath: 'v2/guide' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        presetName: 'aws-cdk-2',
        defaultBranch: 'main',
        fileExtensions: ['.adoc'],
        excludeFiles: ['book.adoc'],
      });
      expect(stats.downloaded).toBe(1);
      expect(readdirSync(dir).filter((f) => !f.startsWith('.'))).toEqual(['intro.adoc']);
    });
  });

  it('accepts multiple repoPath roots and strips each matched prefix', async () => {
    await withTmp(async (dir) => {
      mockFetchForTree({
        tree: [
          { path: 'docs/a.md', type: 'blob' },
          { path: 'examples/b.md', type: 'blob' },
          { path: 'src/skip.md', type: 'blob' },
        ],
      });
      const stats = await fetchGithubTree({
        src: {
          name: 'multi',
          url: 'https://github.com/acme/docs',
          repoPath: ['docs', 'examples'],
        },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        presetName: 'multi-1',
        defaultBranch: 'main',
      });
      expect(stats.downloaded).toBe(2);
      expect(existsSync(join(dir, 'a.md'))).toBe(true);
      expect(existsSync(join(dir, 'b.md'))).toBe(true);
      expect(existsSync(join(dir, 'skip.md'))).toBe(false);
    });
  });

  it('honours excludePathPattern for language-directory filters', async () => {
    await withTmp(async (dir) => {
      mockFetchForTree({
        tree: [
          { path: 'docs/en.md', type: 'blob' },
          { path: 'docs/zh-CN/intro.md', type: 'blob' },
        ],
      });
      const stats = await fetchGithubTree({
        src: { name: 'cmd', url: 'https://github.com/tj/commander.js', repoPath: 'docs' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        presetName: 'commander-14',
        defaultBranch: 'master',
        excludePathPattern: /\/zh-CN\//,
      });
      expect(stats.downloaded).toBe(1);
      expect(existsSync(join(dir, 'en.md'))).toBe(true);
    });
  });

  it('dryRun skips writes', async () => {
    await withTmp(async (dir) => {
      mockFetchForTree({
        tree: [{ path: 'a.md', type: 'blob' }],
      });
      const stats = await fetchGithubTree({
        src: { name: 'dry', url: 'https://github.com/acme/docs' },
        outDir: dir,
        options: { dryRun: true },
        stats: createEmptyStats(),
        presetName: 'dry-1',
        defaultBranch: 'main',
      });
      expect(stats.downloaded).toBe(0);
      expect(readdirSync(dir).filter((f) => !f.startsWith('.'))).toEqual([]);
    });
  });

  it('counts failed downloads without aborting', async () => {
    await withTmp(async (dir) => {
      mockFetchForTree({
        tree: [
          { path: 'a.md', type: 'blob' },
          { path: 'b.md', type: 'blob' },
        ],
        contentStatus: 500,
      });
      const stats = await fetchGithubTree({
        src: { name: 'fail', url: 'https://github.com/acme/docs' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        presetName: 'fail-1',
        defaultBranch: 'main',
      });
      expect(stats.failed).toBe(2);
      expect(stats.downloaded).toBe(0);
    });
  });

  it('uses subtree SHA resolution when useSubtreeSha=true', async () => {
    await withTmp(async (dir) => {
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/git/trees/main?recursive=1')) {
          throw new Error('should not call root recursive with useSubtreeSha');
        }
        if (url.endsWith('/git/trees/main')) {
          return json({
            tree: [
              { path: 'apps', type: 'tree', sha: 'a'.repeat(40) },
              { path: 'src', type: 'tree', sha: 'c'.repeat(40) },
            ],
          });
        }
        if (url.endsWith(`/git/trees/${'a'.repeat(40)}`)) {
          return json({
            tree: [{ path: 'docs', type: 'tree', sha: 'b'.repeat(40) }],
          });
        }
        if (url.endsWith(`/git/trees/${'b'.repeat(40)}?recursive=1`)) {
          return json({
            tree: [{ path: 'intro.md', type: 'blob', sha: 'd'.repeat(40) }],
          });
        }
        if (url.startsWith('https://raw.githubusercontent.com/')) {
          return new Response('# intro', { status: 200 });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }) as unknown as typeof fetch;

      const stats = await fetchGithubTree({
        src: {
          name: 'sup',
          url: 'https://github.com/acme/big',
          repoPath: 'apps/docs',
        },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        presetName: 'supabase-2',
        defaultBranch: 'main',
        useSubtreeSha: true,
      });
      expect(stats.downloaded).toBe(1);
      expect(existsSync(join(dir, 'intro.md'))).toBe(true);
    });
  });

  it('returns stats unchanged when tree API fails', async () => {
    await withTmp(async (dir) => {
      globalThis.fetch = vi.fn(
        async () => new Response('', { status: 500 }),
      ) as unknown as typeof fetch;
      const stats = await fetchGithubTree({
        src: { name: 'bad', url: 'https://github.com/acme/docs' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        presetName: 'bad-1',
        defaultBranch: 'main',
      });
      expect(stats.downloaded).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
