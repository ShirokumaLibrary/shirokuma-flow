/**
 * detect コマンド・fetch --auto-detect コマンドの CLI テスト（flow/docs から移植）
 *
 * shirokuma-context detect / fetch --auto-detect の動作を spawnSync で検証する。
 *
 * @testdoc detect・fetch --auto-detect コマンドの CLI レベルテスト
 */

import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const CLI_SRC = resolve(__dirname, '..', '..', 'src', 'cli.ts');
const TSX = resolve(__dirname, '..', '..', 'node_modules', '.bin', 'tsx');

function withTmp<T>(run: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'context-detect-cli-'));
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runCli(
  args: string[],
  cwd?: string,
): { stdout: string; stderr: string; status: number } {
  const r = spawnSync(TSX, [CLI_SRC, ...args], { encoding: 'utf-8', cwd });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status ?? 0 };
}

// =============================================================================
// detect コマンド
// =============================================================================

describe('shirokuma-context detect', () => {
  it('package.json が存在しない場合はエラー JSON を返す', () => {
    withTmp((root) => {
      const r = runCli(['--project', root, 'detect']);
      // エラー JSON が返る
      expect(r.status).toBe(1);
      const parsed = JSON.parse(r.stdout) as { error: string };
      expect(parsed.error).toBeTruthy();
    });
  });

  it('マッチする依存がない場合は空配列のメッセージを返す', () => {
    withTmp((root) => {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ dependencies: { 'unknown-lib': '1.0.0' } }),
        'utf-8',
      );

      const r = runCli(['--project', root, 'detect']);
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout) as { message: string; detected: unknown[] };
      expect(Array.isArray(parsed.detected)).toBe(true);
      expect(parsed.detected).toHaveLength(0);
    });
  });

  it('next が dependencies にある場合 nextjs-16 を検出する（table-json 形式）', () => {
    withTmp((root) => {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ dependencies: { next: '^16.0.0' } }),
        'utf-8',
      );

      const r = runCli(['--project', root, 'detect']);
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout) as Array<{ Source: string; Packages: string; Status: string }>;
      const found = parsed.find((row) => row.Source === 'nextjs-16');
      expect(found).toBeDefined();
      expect(found?.Packages).toContain('next');
      expect(found?.Status).toBe('not-fetched');
    });
  });

  it('--format json で DetectResult 形式が返る', () => {
    withTmp((root) => {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ devDependencies: { typescript: '^5.0.0' } }),
        'utf-8',
      );

      const r = runCli(['--project', root, 'detect', '--format', 'json']);
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout) as Array<{ source: string; packages: string[]; status: string }>;
      const found = parsed.find((row) => row.source === 'typescript-5');
      expect(found).toBeDefined();
      expect(found?.packages).toContain('typescript');
    });
  });

  it('.last-fetched が存在する場合 status が ready になる', () => {
    withTmp((root) => {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ dependencies: { next: '^16.0.0' } }),
        'utf-8',
      );
      const outDir = join(root, '.shirokuma/contexts/nextjs-16');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, '.last-fetched'), new Date().toISOString(), 'utf-8');

      const r = runCli(['--project', root, 'detect', '--format', 'json']);
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout) as Array<{ source: string; status: string }>;
      const found = parsed.find((row) => row.source === 'nextjs-16');
      expect(found?.status).toBe('ready');
    });
  });
});

// =============================================================================
// fetch --auto-detect コマンド
// =============================================================================

describe('shirokuma-context fetch --auto-detect', () => {
  it('package.json が存在しない場合はエラー JSON を返す', () => {
    withTmp((root) => {
      const r = runCli(['--project', root, 'fetch', '--auto-detect']);
      expect(r.status).toBe(1);
      const parsed = JSON.parse(r.stdout) as { error: string };
      expect(parsed.error).toBeTruthy();
    });
  });

  it('マッチする依存がない場合は 0 件で正常終了する', () => {
    withTmp((root) => {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ dependencies: { 'unknown-lib': '1.0.0' } }),
        'utf-8',
      );

      const r = runCli(['--project', root, 'fetch', '--auto-detect']);
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout) as { ok: boolean; detected: number; fetched: number };
      expect(parsed.ok).toBe(true);
      expect(parsed.detected).toBe(0);
    });
  });

  it('fetch 済みのソースはスキップされる（.last-fetched あり）', () => {
    withTmp((root) => {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ dependencies: { next: '^16.0.0' } }),
        'utf-8',
      );
      const outDir = join(root, '.shirokuma/contexts/nextjs-16');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, '.last-fetched'), new Date().toISOString(), 'utf-8');

      const r = runCli(['--project', root, 'fetch', '--auto-detect']);
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout) as { ok: boolean; message: string; detected: number; fetched: number };
      expect(parsed.ok).toBe(true);
      expect(parsed.detected).toBe(1); // 1 件検出
      expect(parsed.fetched).toBe(0); // 全て fetch 済みでスキップ
    });
  });

  it('--auto-detect と name 引数の同時指定はエラー', () => {
    withTmp((root) => {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ dependencies: { next: '^16.0.0' } }),
        'utf-8',
      );

      const r = runCli(['--project', root, 'fetch', '--auto-detect', 'nextjs-16']);
      expect(r.status).toBe(1);
      const parsed = JSON.parse(r.stdout) as { error: string };
      expect(parsed.error).toBeTruthy();
    });
  });

  it('未 fetch ソースは --dry-run で fetch 予定として出力される', () => {
    withTmp((root) => {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ dependencies: { next: '^16.0.0' } }),
        'utf-8',
      );
      // .last-fetched は作成しない（未 fetch）

      // --pretty なしで JSON のみ出力（logger ログは NOOP）
      const r = runCli(['--project', root, 'fetch', '--auto-detect', '--dry-run']);
      expect(r.status).toBe(0);
      // dry-run 時は結果を JSON で出力
      const parsed = JSON.parse(r.stdout) as { ok: boolean; results: unknown[] };
      expect(parsed.ok).toBe(true);
    });
  });
});

// =============================================================================
// fetch [name] 省略時（全ソース再取得）
// =============================================================================

describe('shirokuma-context fetch (name 省略時)', () => {
  it('fetch 済みソースがない場合はエラー JSON を返す', () => {
    withTmp((root) => {
      const r = runCli(['--project', root, 'fetch']);
      expect(r.status).toBe(1);
      const parsed = JSON.parse(r.stdout) as { error: string };
      expect(parsed.error).toBeTruthy();
    });
  });
});
