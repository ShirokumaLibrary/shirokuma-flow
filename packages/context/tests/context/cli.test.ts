import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// context パッケージの CLI（src/cli.ts）をテストする
const CLI_SRC = resolve(__dirname, '..', '..', 'src', 'cli.ts');
const TSX = resolve(__dirname, '..', '..', 'node_modules', '.bin', 'tsx');

function withTmp<T>(run: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'context-cli-'));
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function run(args: string[], cwd?: string): { stdout: string; stderr: string; status: number } {
  // context CLI を直接実行（context サブコマンドプレフィックスは不要）
  const r = spawnSync(TSX, [CLI_SRC, ...args], { encoding: 'utf-8', cwd });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status ?? 0 };
}

describe('shirokuma-context CLI', () => {
  it('list returns [] as JSON when no docs root exists', () => {
    withTmp((root) => {
      const r = run(['--project', root, 'list']);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout)).toEqual([]);
    });
  });

  it('list returns discovered sources', () => {
    withTmp((root) => {
      const bun = join(root, '.shirokuma', 'contexts', 'bun');
      mkdirSync(bun, { recursive: true });
      writeFileSync(join(bun, 'a.md'), 'x');
      writeFileSync(join(bun, '.last-fetched'), '2026-04-19T10:00:00.000Z');

      const r = run(['--project', root, '--pretty', 'list']);
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout) as Array<{ name: string; fileCount: number }>;
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({ name: 'bun', fileCount: 1 });
    });
  });

  it('remove without --yes previews without deleting', () => {
    withTmp((root) => {
      const bun = join(root, '.shirokuma', 'contexts', 'bun');
      mkdirSync(bun, { recursive: true });
      writeFileSync(join(bun, 'a.md'), 'x');

      const r = run(['--project', root, 'remove', 'bun']);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout)).toMatchObject({ ok: false });
      expect(readFileSync(join(bun, 'a.md'), 'utf-8')).toBe('x');
    });
  });

  it('remove --yes deletes the directory and exits 0', () => {
    withTmp((root) => {
      const bun = join(root, '.shirokuma', 'contexts', 'bun');
      mkdirSync(bun, { recursive: true });
      writeFileSync(join(bun, 'a.md'), 'x');

      const r = run(['--project', root, 'remove', 'bun', '--yes']);
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout) as { removed: boolean };
      expect(parsed.removed).toBe(true);
    });
  });

  it('search returns matches as JSON', () => {
    withTmp((root) => {
      const bun = join(root, '.shirokuma', 'contexts', 'bun');
      mkdirSync(bun, { recursive: true });
      writeFileSync(join(bun, 'a.md'), 'hello world\nfoo bar\n');

      const r = run(['--project', root, 'search', 'hello']);
      expect(r.status).toBe(0);
      const matches = JSON.parse(r.stdout) as Array<{ source: string; line: number }>;
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({ source: 'bun', line: 1 });
    });
  });

  it('fetch on unknown preset exits 1 with available list', () => {
    withTmp((root) => {
      const r = run(['--project', root, 'fetch', 'no-such-preset']);
      expect(r.status).toBe(1);
      const parsed = JSON.parse(r.stdout) as { error: string; available: string[] };
      expect(parsed.error).toContain('unknown preset');
      expect(parsed.available.length).toBeGreaterThan(30);
    });
  });

  it('manifest regenerates MANIFEST.md from discovered sources', () => {
    withTmp((root) => {
      const bun = join(root, '.shirokuma', 'contexts', 'bun-1');
      mkdirSync(bun, { recursive: true });
      writeFileSync(join(bun, 'a.md'), 'x');
      writeFileSync(join(bun, '.last-fetched'), '2026-04-19T00:00:00.000Z');

      const r = run(['--project', root, 'manifest']);
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout) as { ok: boolean };
      expect(parsed.ok).toBe(true);
      const manifest = readFileSync(join(root, '.shirokuma', 'contexts', 'MANIFEST.md'), 'utf-8');
      expect(manifest).toContain('| bun-1 |');
    });
  });
});
