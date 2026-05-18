/**
 * shirokuma-portal CLI テスト（ADR-v3-019: JSON ヘルプ統合後）
 */
import { describe, it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(here, '../dist/cli.js');

describe('shirokuma-portal CLI (ADR-v3-019 JSON help)', () => {
  it('--help で JSON ヘルプが出力される（AI-readable）', () => {
    const result = spawnSync('node', [cliPath, '--help'], { encoding: 'utf-8' });
    // exit 0 かつ JSON 出力
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as { cmd: string; sub: unknown[] | null };
    expect(parsed.cmd).toContain('shirokuma-portal');
    expect(parsed.sub).not.toBeNull();
  });

  it('--help-human でテキストヘルプが出力される', () => {
    const result = spawnSync('node', [cliPath, '--help-human'], { encoding: 'utf-8' });
    expect(result.status).toBe(0);
    // テキスト出力は JSON でない
    expect(result.stdout).toContain('shirokuma-portal');
    expect(() => JSON.parse(result.stdout)).toThrow();
  });

  it('--pretty で JSON がインデントされる', () => {
    const result = spawnSync('node', [cliPath, '--pretty', '--help'], { encoding: 'utf-8' });
    expect(result.status).toBe(0);
    // インデントがある（複数行）
    expect(result.stdout.split('\n').length).toBeGreaterThan(2);
    const parsed = JSON.parse(result.stdout) as { cmd: string };
    expect(parsed.cmd).toContain('shirokuma-portal');
  });

  it('generate --help で JSON サブコマンド情報が出力される', () => {
    const result = spawnSync('node', [cliPath, 'generate', '--help'], { encoding: 'utf-8' });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as { cmd: string; sub: Array<{ cmd: string }> | null };
    expect(parsed.cmd).toContain('generate');
    // all, typedoc, portal 等のサブコマンドが含まれる
    const subNames = (parsed.sub ?? []).map((s) => s.cmd.split(' ').pop());
    expect(subNames).toContain('all');
    expect(subNames).toContain('typedoc');
    expect(subNames).toContain('portal');
  });

  it('--version でバージョン番号が出力される（exit 0）', () => {
    const result = spawnSync('node', [cliPath, '--version'], { encoding: 'utf-8' });
    expect(result.status).toBe(0);
  });

  it('describe でコマンドツリー全体が出力される', () => {
    const result = spawnSync('node', [cliPath, 'describe'], { encoding: 'utf-8' });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as { cmd: string; sub: unknown[] | null };
    expect(parsed.cmd).toContain('shirokuma-portal');
    expect(parsed.sub).not.toBeNull();
  });

  it('--locale ja generate all --help で generate/all の JSON ヘルプが出力される（value-taking option 正解析）', () => {
    // --locale は値を取るオプション。preflightArgv が "ja" を positional と誤認しないことを検証
    const result = spawnSync('node', [cliPath, '--locale', 'ja', 'generate', 'all', '--help'], {
      encoding: 'utf-8',
    });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as { cmd: string };
    // "generate all" のヘルプが返ること（root ではなく正しい target に降りること）
    expect(parsed.cmd).toContain('generate');
    expect(parsed.cmd).toContain('all');
  });
});
