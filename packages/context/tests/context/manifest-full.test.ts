/**
 * manifest 機能テスト（flow/docs から移植）
 *
 * MANIFEST.md の生成・パース・マージ・エントリ削除を検証する。
 *
 * @testdoc docs manifest の生成・パース・マージ・削除テスト
 */

import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  formatManifest,
  parseManifest,
  removeManifestEntry,
  writeManifest,
  type ManifestEntry,
} from '../../src/context/manifest.js';

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-manifest-'));
  const cleanup = () => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  };
  return Promise.resolve(run(dir)).finally(cleanup);
}

// =============================================================================
// parseManifest
// =============================================================================

describe('parseManifest', () => {
  it('テーブル行から ManifestEntry 配列をパースする', () => {
    const content = [
      '# Docs Manifest',
      '',
      'fetch 済みのドキュメントソース。',
      '',
      '| ソース | パッケージ | Last Fetched | ファイル数 |',
      '|-------|----------|-------------|---------|',
      '| nextjs-16 | next | 2026-03-25 | 423 |',
      '| typescript-5 | typescript | 2026-03-25 | 89 |',
      '',
    ].join('\n');

    const entries = parseManifest(content);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      source: 'nextjs-16',
      package: 'next',
      lastFetched: '2026-03-25',
      fileCount: 423,
    });
    expect(entries[1]).toEqual({
      source: 'typescript-5',
      package: 'typescript',
      lastFetched: '2026-03-25',
      fileCount: 89,
    });
  });

  it('空の manifest は空配列を返す', () => {
    const content = '# Docs Manifest\n\n(ソースなし)\n';
    expect(parseManifest(content)).toEqual([]);
  });

  it('ヘッダー行とセパレータ行はスキップされる', () => {
    const content = [
      '| ソース | パッケージ | Last Fetched | ファイル数 |',
      '|-------|----------|-------------|---------|',
      '| vitest-4 | vitest | 2026-03-20 | 50 |',
    ].join('\n');

    const entries = parseManifest(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe('vitest-4');
  });
});

// =============================================================================
// formatManifest
// =============================================================================

describe('formatManifest', () => {
  it('エントリ配列から正しい MANIFEST.md を生成する', () => {
    const entries: ManifestEntry[] = [
      { source: 'nextjs-16', package: 'next', lastFetched: '2026-03-25', fileCount: 423 },
      { source: 'typescript-5', package: 'typescript', lastFetched: '2026-03-25', fileCount: 89 },
    ];

    const result = formatManifest(entries);

    expect(result).toContain('# Docs Manifest');
    expect(result).toContain('| ソース | パッケージ | Last Fetched | ファイル数 |');
    expect(result).toContain('| nextjs-16 | next | 2026-03-25 | 423 |');
    expect(result).toContain('| typescript-5 | typescript | 2026-03-25 | 89 |');
  });

  it('エントリがソース名でソートされる', () => {
    const entries: ManifestEntry[] = [
      { source: 'vitest-4', package: 'vitest', lastFetched: '2026-03-25', fileCount: 50 },
      { source: 'nextjs-16', package: 'next', lastFetched: '2026-03-25', fileCount: 423 },
    ];

    const result = formatManifest(entries);
    const nextjsIdx = result.indexOf('nextjs-16');
    const vitestIdx = result.indexOf('vitest-4');
    expect(nextjsIdx).toBeLessThan(vitestIdx);
  });

  it('空配列の場合は「ソースなし」を出力する', () => {
    const result = formatManifest([]);
    expect(result).toContain('(ソースなし)');
    expect(result).not.toContain('| ソース |');
  });
});

// =============================================================================
// formatManifest → parseManifest ラウンドトリップ
// =============================================================================

describe('formatManifest → parseManifest ラウンドトリップ', () => {
  it('生成した manifest を正しくパースできる', () => {
    const entries: ManifestEntry[] = [
      { source: 'nextjs-16', package: 'next', lastFetched: '2026-03-25', fileCount: 423 },
      { source: 'typescript-5', package: 'typescript', lastFetched: '2026-03-25', fileCount: 89 },
    ];

    const formatted = formatManifest(entries);
    const parsed = parseManifest(formatted);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual(entries[0]);
    expect(parsed[1]).toEqual(entries[1]);
  });
});

// =============================================================================
// writeManifest (integration)
// =============================================================================

describe('writeManifest', () => {
  it('fetch 済みソースの manifest を生成する', async () => {
    await withTmp(async (tmpDir) => {
      const outDir = join(tmpDir, '.shirokuma/contexts/nextjs-16');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, '.last-fetched'), '2026-03-25T10:00:00.000Z', 'utf-8');
      writeFileSync(join(outDir, 'page1.md'), '# Page 1', 'utf-8');
      writeFileSync(join(outDir, 'page2.md'), '# Page 2', 'utf-8');

      await writeManifest({
        projectPath: tmpDir,
        sources: [{ name: 'nextjs-16' }],
        resolvePackageName: () => 'next',
      });

      const manifestPath = join(tmpDir, '.shirokuma/contexts/MANIFEST.md');
      expect(existsSync(manifestPath)).toBe(true);

      const content = readFileSync(manifestPath, 'utf-8');
      expect(content).toContain('# Docs Manifest');
      expect(content).toContain('nextjs-16');
      expect(content).toContain('2026-03-25');
      expect(content).toContain('| 2 |');
    });
  });

  it('未 fetch のソースは manifest に含まれない', async () => {
    await withTmp(async (tmpDir) => {
      const outDir = join(tmpDir, '.shirokuma/contexts/nextjs-16');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, '.last-fetched'), '2026-03-25T10:00:00.000Z', 'utf-8');
      writeFileSync(join(outDir, 'page1.md'), '# Page 1', 'utf-8');

      await writeManifest({
        projectPath: tmpDir,
        sources: [{ name: 'nextjs-16' }, { name: 'vitest-4' }],
        resolvePackageName: (n) => n,
      });

      const content = readFileSync(
        join(tmpDir, '.shirokuma/contexts/MANIFEST.md'),
        'utf-8',
      );
      expect(content).toContain('nextjs-16');
      expect(content).not.toContain('vitest-4');
    });
  });

  it('既存 manifest にマージする（config 外のエントリを保持）', async () => {
    await withTmp(async (tmpDir) => {
      const outDir = join(tmpDir, '.shirokuma/contexts/nextjs-16');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, '.last-fetched'), '2026-03-25T10:00:00.000Z', 'utf-8');
      writeFileSync(join(outDir, 'page1.md'), '# Page 1', 'utf-8');

      // 既存エントリとなるカスタムソースのディレクトリも作成しておく（evict されないように）
      const customDir = join(tmpDir, '.shirokuma/contexts/custom-source');
      mkdirSync(customDir, { recursive: true });

      const docsRoot = join(tmpDir, '.shirokuma/contexts');
      const existingManifest = [
        '# Docs Manifest',
        '',
        'fetch 済みのドキュメントソース。',
        '',
        '| ソース | パッケージ | Last Fetched | ファイル数 |',
        '|-------|----------|-------------|---------|',
        '| custom-source | custom-pkg | 2026-03-20 | 10 |',
        '',
      ].join('\n');
      writeFileSync(join(docsRoot, 'MANIFEST.md'), existingManifest, 'utf-8');

      await writeManifest({
        projectPath: tmpDir,
        sources: [{ name: 'nextjs-16' }],
        resolvePackageName: () => 'next',
      });

      const content = readFileSync(join(docsRoot, 'MANIFEST.md'), 'utf-8');
      expect(content).toContain('nextjs-16');
      expect(content).toContain('custom-source');
    });
  });
});

// =============================================================================
// removeManifestEntry
// =============================================================================

describe('removeManifestEntry', () => {
  it('指定ソースのエントリを削除する', async () => {
    await withTmp(async (tmpDir) => {
      const docsRoot = join(tmpDir, '.shirokuma/contexts');
      mkdirSync(docsRoot, { recursive: true });

      const manifest = [
        '# Docs Manifest',
        '',
        'fetch 済みのドキュメントソース。',
        '',
        '| ソース | パッケージ | Last Fetched | ファイル数 |',
        '|-------|----------|-------------|---------|',
        '| nextjs-16 | next | 2026-03-25 | 423 |',
        '| typescript-5 | typescript | 2026-03-25 | 89 |',
        '',
      ].join('\n');
      writeFileSync(join(docsRoot, 'MANIFEST.md'), manifest, 'utf-8');

      removeManifestEntry(tmpDir, 'nextjs-16');

      const content = readFileSync(join(docsRoot, 'MANIFEST.md'), 'utf-8');
      expect(content).not.toContain('nextjs-16');
      expect(content).toContain('typescript-5');
    });
  });

  it('manifest が存在しない場合はエラーにならない', async () => {
    await withTmp(async (tmpDir) => {
      expect(() => removeManifestEntry(tmpDir, 'nextjs-16')).not.toThrow();
    });
  });

  it('指定ソースが manifest にない場合は何も変更しない', async () => {
    await withTmp(async (tmpDir) => {
      const docsRoot = join(tmpDir, '.shirokuma/contexts');
      mkdirSync(docsRoot, { recursive: true });

      const manifest = [
        '# Docs Manifest',
        '',
        'fetch 済みのドキュメントソース。',
        '',
        '| ソース | パッケージ | Last Fetched | ファイル数 |',
        '|-------|----------|-------------|---------|',
        '| nextjs-16 | next | 2026-03-25 | 423 |',
        '',
      ].join('\n');
      writeFileSync(join(docsRoot, 'MANIFEST.md'), manifest, 'utf-8');

      removeManifestEntry(tmpDir, 'nonexistent-source');

      const content = readFileSync(join(docsRoot, 'MANIFEST.md'), 'utf-8');
      expect(content).toContain('nextjs-16');
    });
  });

  it('全エントリ削除後は「ソースなし」になる', async () => {
    await withTmp(async (tmpDir) => {
      const docsRoot = join(tmpDir, '.shirokuma/contexts');
      mkdirSync(docsRoot, { recursive: true });

      const manifest = [
        '# Docs Manifest',
        '',
        'fetch 済みのドキュメントソース。',
        '',
        '| ソース | パッケージ | Last Fetched | ファイル数 |',
        '|-------|----------|-------------|---------|',
        '| nextjs-16 | next | 2026-03-25 | 423 |',
        '',
      ].join('\n');
      writeFileSync(join(docsRoot, 'MANIFEST.md'), manifest, 'utf-8');

      removeManifestEntry(tmpDir, 'nextjs-16');

      const content = readFileSync(join(docsRoot, 'MANIFEST.md'), 'utf-8');
      expect(content).toContain('(ソースなし)');
      expect(content).not.toContain('nextjs-16');
    });
  });
});
