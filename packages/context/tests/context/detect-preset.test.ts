/**
 * detect 機能テスト（flow/docs から移植）
 *
 * detectFromPackageJson および detect CLI コマンドの packageNames マッピング・
 * ステータス判定を検証する。
 *
 * @testdoc detect コマンドの package.json 依存マッピング・ステータス判定テスト
 */

import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectFromPackageJson } from '../../src/context/detect.js';
import { PRESETS, resolvePresetMeta, listPresetNames } from '../../src/context/presets.js';

function withTmp<T>(run: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'context-detect-'));
  return Promise.resolve(run(dir)).finally(() =>
    rmSync(dir, { recursive: true, force: true }),
  );
}

// =============================================================================
// resolvePresetMeta の packageNames
// =============================================================================

describe('resolvePresetMeta.packageNames', () => {
  it('packageNames を持つプリセットは全て文字列配列である', () => {
    const names = listPresetNames();
    for (const name of names) {
      const meta = resolvePresetMeta(name);
      expect(name).toBeTruthy();
      if (meta?.packageNames !== undefined) {
        expect(Array.isArray(meta.packageNames)).toBe(true);
        expect(
          (meta.packageNames as string[]).every((p: unknown) => typeof p === 'string'),
        ).toBe(true);
        expect((meta.packageNames as string[]).length).toBeGreaterThan(0);
      }
    }
  });

  it('主要プリセットに適切な packageNames が定義されている', () => {
    const nextjs = resolvePresetMeta('nextjs-16');
    expect(nextjs?.packageNames).toContain('next');

    const react = resolvePresetMeta('react-19');
    expect(react?.packageNames).toContain('react');

    const drizzle = resolvePresetMeta('drizzle-0');
    expect(drizzle?.packageNames).toContain('drizzle-orm');
    expect(drizzle?.packageNames).toContain('drizzle-kit');

    const vitest = resolvePresetMeta('vitest-4');
    expect(vitest?.packageNames).toContain('vitest');

    const tailwind = resolvePresetMeta('tailwindcss-4');
    expect(tailwind?.packageNames).toContain('tailwindcss');

    const playwright = resolvePresetMeta('playwright-1');
    expect(playwright?.packageNames).toContain('@playwright/test');

    const typescript = resolvePresetMeta('typescript-5');
    expect(typescript?.packageNames).toContain('typescript');

    const remix = resolvePresetMeta('remix-2');
    expect(remix?.packageNames).toContain('@remix-run/node');

    const supabase = resolvePresetMeta('supabase-2');
    expect(supabase?.packageNames).toContain('@supabase/supabase-js');
  });
});

// =============================================================================
// detectFromPackageJson
// =============================================================================

describe('detectFromPackageJson', () => {
  it('package.json の dependencies がない場合は空配列を返す', () => {
    const results = detectFromPackageJson({});
    expect(results).toEqual([]);
  });

  it('マッチする依存がない場合は空配列を返す', () => {
    const results = detectFromPackageJson({
      dependencies: { 'unknown-package': '1.0.0' },
    });
    expect(results).toEqual([]);
  });

  it('next が dependencies にある場合 nextjs-16 を検出する', () => {
    const results = detectFromPackageJson({ dependencies: { next: '^16.0.0' } });
    const found = results.find((r) => r.preset === 'nextjs-16');
    expect(found).toBeDefined();
    expect(found?.matchedPackages).toContain('next');
  });

  it('devDependencies の typescript も検出対象になる', () => {
    const results = detectFromPackageJson({ devDependencies: { typescript: '^5.0.0' } });
    const found = results.find((r) => r.preset === 'typescript-5');
    expect(found).toBeDefined();
    expect(found?.matchedPackages).toContain('typescript');
  });
});

// =============================================================================
// detect コマンドロジック（.last-fetched によるステータス判定）
// =============================================================================

describe('detect コマンド - ステータス判定', () => {
  it('.last-fetched が存在しない場合 status が not-fetched になる', async () => {
    await withTmp(async (tmpDir) => {
      writeFileSync(
        join(tmpDir, 'package.json'),
        JSON.stringify({ dependencies: { next: '^16.0.0' } }),
        'utf-8',
      );

      const output: string[] = [];
      const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        if (typeof chunk === 'string') output.push(chunk);
        return true;
      });

      // detect CLI の動作を直接テスト（detectFromPackageJson + readLastFetched）
      const { readLastFetched, resolveOutputDir } = await import('../../src/context/fs-helpers.js');
      const detected = detectFromPackageJson({ dependencies: { next: '^16.0.0' } });
      const withStatus = detected.map((d) => {
        const outDir = resolveOutputDir({ projectPath: tmpDir, sourceName: d.preset });
        const fetched = readLastFetched(outDir);
        return { source: d.preset, packages: d.matchedPackages, status: fetched ? 'ready' : 'not-fetched' };
      });

      spy.mockRestore();

      const found = withStatus.find((r) => r.source === 'nextjs-16');
      expect(found?.status).toBe('not-fetched');
    });
  });

  it('.last-fetched が存在する場合 status が ready になる', async () => {
    await withTmp(async (tmpDir) => {
      writeFileSync(
        join(tmpDir, 'package.json'),
        JSON.stringify({ dependencies: { next: '^16.0.0' } }),
        'utf-8',
      );
      const outDir = join(tmpDir, '.shirokuma/contexts/nextjs-16');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, '.last-fetched'), new Date().toISOString(), 'utf-8');

      const { readLastFetched, resolveOutputDir } = await import('../../src/context/fs-helpers.js');
      const detected = detectFromPackageJson({ dependencies: { next: '^16.0.0' } });
      const withStatus = detected.map((d) => {
        const dir = resolveOutputDir({ projectPath: tmpDir, sourceName: d.preset });
        const fetched = readLastFetched(dir);
        return { source: d.preset, packages: d.matchedPackages, status: fetched ? 'ready' : 'not-fetched' };
      });

      const found = withStatus.find((r) => r.source === 'nextjs-16');
      expect(found?.status).toBe('ready');
    });
  });
});
