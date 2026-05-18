import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processImages } from '../../src/context/process-images.js';
import { createEmptyStats } from '../../src/context/stats.js';
import { NOOP_LOGGER } from '../../src/context/logger.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-images-'));
  return Promise.resolve(run(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

function mockFetch(handler: (url: string) => Response): void {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) =>
    handler(typeof input === 'string' ? input : input.toString()),
  ) as unknown as typeof fetch;
}

describe('processImages', () => {
  it('downloads referenced images and rewrites paths to ./{localName}', async () => {
    await withTmp(async (dir) => {
      mockFetch(() => new Response(new Uint8Array([0, 1, 2]), { status: 200 }));
      writeFileSync(join(dir, 'doc.md'), '# Title\n![alt](https://cdn.example.com/img/pic.png)\n');
      const stats = createEmptyStats();
      await processImages({
        outDir: dir,
        force: true,
        stats,
        logger: NOOP_LOGGER,
        sourceName: 'demo',
      });
      expect(stats.imagesDownloaded).toBe(1);
      expect(existsSync(join(dir, 'pic.png'))).toBe(true);
      const rewritten = readFileSync(join(dir, 'doc.md'), 'utf-8');
      expect(rewritten).toContain('![alt](./pic.png)');
    });
  });

  it('skips existing images when not force', async () => {
    await withTmp(async (dir) => {
      writeFileSync(join(dir, 'pic.png'), Buffer.from([9, 9]));
      writeFileSync(join(dir, 'doc.md'), '![a](https://cdn.example.com/pic.png)');
      mockFetch(() => {
        throw new Error('should not be called');
      });
      const stats = createEmptyStats();
      await processImages({
        outDir: dir,
        force: false,
        stats,
        logger: NOOP_LOGGER,
        sourceName: 'demo',
      });
      expect(stats.imagesSkipped).toBe(1);
      expect(stats.imagesDownloaded).toBe(0);
    });
  });

  it('counts failed downloads without throwing', async () => {
    await withTmp(async (dir) => {
      mockFetch(() => new Response('', { status: 500 }));
      writeFileSync(join(dir, 'doc.md'), '![a](https://cdn.example.com/pic.png)');
      const stats = createEmptyStats();
      await processImages({
        outDir: dir,
        force: true,
        stats,
        logger: NOOP_LOGGER,
        sourceName: 'demo',
      });
      expect(stats.imagesFailed).toBe(1);
      expect(stats.imagesDownloaded).toBe(0);
    });
  });

  it('uses injected svgConverter for SVG files', async () => {
    await withTmp(async (dir) => {
      mockFetch(() => new Response('<svg/>', { status: 200 }));
      writeFileSync(join(dir, 'doc.md'), '![s](https://cdn.example.com/diagram.svg)');
      const stats = createEmptyStats();
      const converter = vi.fn(async () => true);
      await processImages({
        outDir: dir,
        force: true,
        stats,
        logger: NOOP_LOGGER,
        sourceName: 'demo',
        svgConverter: converter,
      });
      expect(stats.svgConverted).toBe(1);
      expect(stats.svgKept).toBe(0);
      expect(converter).toHaveBeenCalledOnce();
    });
  });

  it('counts svgKept when no converter is injected', async () => {
    await withTmp(async (dir) => {
      mockFetch(() => new Response('<svg/>', { status: 200 }));
      writeFileSync(join(dir, 'doc.md'), '![s](https://cdn.example.com/d.svg)');
      const stats = createEmptyStats();
      await processImages({
        outDir: dir,
        force: true,
        stats,
        logger: NOOP_LOGGER,
        sourceName: 'demo',
      });
      expect(stats.svgConverted).toBe(0);
      expect(stats.svgKept).toBe(1);
    });
  });

  it('caps SVG conversions at the configured maximum', async () => {
    await withTmp(async (dir) => {
      mockFetch(() => new Response('<svg/>', { status: 200 }));
      const refs = Array.from(
        { length: 5 },
        (_, i) => `![s](https://cdn.example.com/d${i}.svg)`,
      ).join('\n');
      writeFileSync(join(dir, 'doc.md'), refs);
      const stats = createEmptyStats();
      const converter = vi.fn(async () => true);
      await processImages({
        outDir: dir,
        force: true,
        stats,
        logger: NOOP_LOGGER,
        sourceName: 'demo',
        svgConverter: converter,
        maxSvgConversions: 2,
      });
      expect(stats.svgConverted).toBe(2);
      expect(stats.svgKept).toBe(3);
    });
  });

  it('ignores Markdown files without image references', async () => {
    await withTmp(async (dir) => {
      writeFileSync(join(dir, 'doc.md'), '# Plain\nno images here');
      mockFetch(() => {
        throw new Error('should not be called');
      });
      const stats = createEmptyStats();
      await processImages({
        outDir: dir,
        force: true,
        stats,
        logger: NOOP_LOGGER,
        sourceName: 'demo',
      });
      expect(stats.imagesDownloaded).toBe(0);
      expect(readdirSync(dir).filter((f) => !f.startsWith('.'))).toEqual(['doc.md']);
    });
  });

  it('no-ops when outDir does not exist', async () => {
    const stats = createEmptyStats();
    await processImages({
      outDir: '/tmp/does-not-exist-context-images-xyz',
      force: true,
      stats,
      logger: NOOP_LOGGER,
      sourceName: 'demo',
    });
    expect(stats.imagesDownloaded).toBe(0);
  });
});
