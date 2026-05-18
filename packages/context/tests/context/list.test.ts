import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listSources } from '../../src/context/list.js';

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-list-'));
  return Promise.resolve(run(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

describe('listSources', () => {
  it('enumerates filesystem sources with fetch status', async () => {
    await withTmp(async (root) => {
      const bunDir = join(root, '.shirokuma', 'contexts', 'bun');
      mkdirSync(bunDir, { recursive: true });
      writeFileSync(join(bunDir, 'a.md'), '');
      writeFileSync(join(bunDir, 'b.md'), '');
      writeFileSync(join(bunDir, '.last-fetched'), '2026-04-19T10:00:00.000Z');
      mkdirSync(join(root, '.shirokuma', 'contexts', 'vue'));

      const statuses = listSources({ projectPath: root });
      const bun = statuses.find((s) => s.name === 'bun');
      const vue = statuses.find((s) => s.name === 'vue');
      expect(bun).toMatchObject({
        name: 'bun',
        fileCount: 2,
        lastFetched: '2026-04-19T10:00:00.000Z',
      });
      expect(vue).toMatchObject({ name: 'vue', fileCount: 0, lastFetched: null });
    });
  });

  it('returns [] when docs root is missing', async () => {
    await withTmp((root) => {
      expect(listSources({ projectPath: root })).toEqual([]);
    });
  });

  it('honors explicit sources list over filesystem discovery', async () => {
    await withTmp(async (root) => {
      mkdirSync(join(root, 'custom', 'bun'), { recursive: true });
      writeFileSync(join(root, 'custom', 'bun', 'a.md'), '');
      const statuses = listSources({
        projectPath: root,
        sources: [{ name: 'bun', url: 'https://bun.com/docs/llms.txt', outputDir: 'custom/bun' }],
      });
      expect(statuses).toHaveLength(1);
      expect(statuses[0]).toMatchObject({
        name: 'bun',
        url: 'https://bun.com/docs/llms.txt',
        fileCount: 1,
      });
    });
  });
});
