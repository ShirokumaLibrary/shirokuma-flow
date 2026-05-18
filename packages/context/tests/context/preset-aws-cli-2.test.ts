import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import TurndownService from 'turndown';
import { execute, htmlToMarkdown, parseLlmsTxtSections } from '../../src/context/presets/aws-cli-2.js';
import { createEmptyStats } from '../../src/context/stats.js';
import { NOOP_LOGGER } from '../../src/context/logger.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-aws-'));
  return Promise.resolve(run(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

describe('parseLlmsTxtSections', () => {
  it('parses ## sections and - page entries', () => {
    const input = [
      '# AWS CLI docs',
      '',
      '## [Get started](https://docs.aws.amazon.com/cli/latest/userguide/getting-started.html)',
      '- [Install](https://docs.aws.amazon.com/cli/latest/userguide/install.html): install',
      '- [Config](https://docs.aws.amazon.com/cli/latest/userguide/config.html)',
      '',
      '## [About the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/about.html)',
      '- [Overview](https://docs.aws.amazon.com/cli/latest/userguide/overview.html)',
    ].join('\n');

    const sections = parseLlmsTxtSections(input);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      dir: 'get-started',
      pages: [
        {
          title: 'Install',
          url: 'https://docs.aws.amazon.com/cli/latest/userguide/install.html',
        },
        {
          title: 'Config',
          url: 'https://docs.aws.amazon.com/cli/latest/userguide/config.html',
        },
      ],
    });
    // "About the AWS CLI" は prefix が先頭ではないので slugify 全体
    expect(sections[1]?.dir).toBe('about-the-aws-cli');
  });

  it('ignores orphan bullets outside any section', () => {
    const input = [
      '- [Orphan](https://example.com/x.html)',
      '## [Start](https://example.com/start.html)',
      '- [Real](https://example.com/real.html)',
    ].join('\n');
    const sections = parseLlmsTxtSections(input);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.pages).toHaveLength(1);
  });
});

describe('htmlToMarkdown', () => {
  it('extracts main-content and strips nav/feedback/footer', () => {
    const html = [
      '<html><body>',
      '<nav>nav</nav>',
      '<div id="main-content">',
      '  <h1>Page Title</h1>',
      '  <p>Body paragraph.</p>',
      '</div>',
      '<div id="feedback">feedback block</div>',
      '<div id="footer">footer</div>',
      '</body></html>',
    ].join('\n');
    const td = new TurndownService({ headingStyle: 'atx' });
    const md = htmlToMarkdown(html, td);
    expect(md).toContain('Page Title');
    expect(md).toContain('Body paragraph.');
    expect(md).not.toContain('nav');
    expect(md).not.toContain('feedback');
    expect(md).not.toContain('footer');
  });
});

describe('aws-cli-2 preset execute', () => {
  it('dryRun lists pages without writing', async () => {
    await withTmp(async (dir) => {
      const llms = [
        '## [Start](https://docs.aws.amazon.com/cli/latest/userguide/start.html)',
        '- [Install](https://docs.aws.amazon.com/cli/latest/userguide/install.html)',
      ].join('\n');
      globalThis.fetch = vi.fn(
        async () => new Response(llms, { status: 200 }),
      ) as unknown as typeof fetch;

      const stats = await execute({
        src: { name: 'aws-cli' },
        outDir: dir,
        options: { dryRun: true },
        stats: createEmptyStats(),
        logger: NOOP_LOGGER,
      });
      expect(stats.downloaded).toBe(0);
      expect(readdirSync(dir)).toEqual([]);
    });
  });

  it('downloads each page and writes to slugified filename under section dir', async () => {
    await withTmp(async (dir) => {
      const llms = [
        '## [Start](https://docs.aws.amazon.com/cli/latest/userguide/start.html)',
        '- [Install CLI](https://docs.aws.amazon.com/cli/latest/userguide/install.html)',
      ].join('\n');
      const page = '<article><h1>Install</h1><p>run the installer</p></article>';
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('llms.txt')) return new Response(llms, { status: 200 });
        if (init?.method === 'HEAD') return new Response(null, { status: 200 });
        return new Response(page, { status: 200 });
      }) as unknown as typeof fetch;

      const stats = await execute({
        src: { name: 'aws-cli' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        logger: NOOP_LOGGER,
      });
      expect(stats.downloaded).toBe(1);
      const file = join(dir, 'start', 'install-cli.md');
      expect(existsSync(file)).toBe(true);
      const md = readFileSync(file, 'utf-8');
      expect(md).toContain('Install');
      expect(md).toContain('run the installer');
      // llms.txt が outDir にコピーされる
      expect(existsSync(join(dir, 'llms.txt'))).toBe(true);
    });
  });

  it('counts failed pages without aborting', async () => {
    await withTmp(async (dir) => {
      const llms = [
        '## [Start](https://docs.aws.amazon.com/cli/latest/userguide/start.html)',
        '- [A](https://docs.aws.amazon.com/cli/latest/userguide/a.html)',
        '- [B](https://docs.aws.amazon.com/cli/latest/userguide/b.html)',
      ].join('\n');
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('llms.txt')) return new Response(llms, { status: 200 });
        return new Response('', { status: 500 });
      }) as unknown as typeof fetch;

      const stats = await execute({
        src: { name: 'aws-cli' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        logger: NOOP_LOGGER,
      });
      expect(stats.failed).toBe(2);
      expect(stats.downloaded).toBe(0);
    });
  });

  it('stops fetching further pages once FAILURE_THRESHOLD is reached', async () => {
    await withTmp(async (dir) => {
      // 60 ページ（閾値 50 超え）を生成し、全部 500 を返す
      const pages: string[] = [];
      for (let i = 0; i < 60; i++) {
        pages.push(`- [P${i}](https://docs.aws.amazon.com/cli/latest/userguide/p${i}.html)`);
      }
      const llms = [
        '## [Start](https://docs.aws.amazon.com/cli/latest/userguide/start.html)',
        ...pages,
      ].join('\n');

      let pageFetches = 0;
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('llms.txt')) return new Response(llms, { status: 200 });
        pageFetches++;
        return new Response('', { status: 500 });
      }) as unknown as typeof fetch;

      const stats = await execute({
        src: { name: 'aws-cli' },
        outDir: dir,
        options: { force: true },
        stats: createEmptyStats(),
        logger: NOOP_LOGGER,
      });
      // 閾値越えで残りタスクが早期 failed 扱いとなり、実際の fetch は 60 未満に留まる
      expect(pageFetches).toBeLessThan(60);
      expect(stats.failed).toBe(60);
    });
  });

  it('errors cleanly when llms.txt fetch fails', async () => {
    await withTmp(async (dir) => {
      globalThis.fetch = vi.fn(
        async () => new Response('', { status: 500 }),
      ) as unknown as typeof fetch;
      const stats = await execute({
        src: { name: 'aws-cli' },
        outDir: dir,
        options: {},
        stats: createEmptyStats(),
        logger: NOOP_LOGGER,
      });
      expect(stats.downloaded).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });
});
