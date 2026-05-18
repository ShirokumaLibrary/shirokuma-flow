/**
 * shirokuma-lint CLI JSON help テスト（ADR-v3-019）
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const CLI_ENTRY = resolve(__dirname, '../src/cli.ts');
const TSX_BIN = resolve(__dirname, '..', 'node_modules', '.bin', 'tsx');

function runCli(args: string[]): { stdout: string; status: number | null; stderr: string } {
  const result = spawnSync(TSX_BIN, [CLI_ENTRY, ...args], { encoding: 'utf-8' });
  return { stdout: result.stdout, status: result.status, stderr: result.stderr };
}

describe('shirokuma-lint CLI JSON help (ADR-v3-019)', () => {
  it('--help で JSON ヘルプが出力される', () => {
    const { stdout, status } = runCli(['--help']);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout) as { cmd: string; sub: unknown[] | null };
    expect(parsed.cmd).toContain('shirokuma-lint');
    expect(parsed.sub).not.toBeNull();
  });

  it('--help-human でテキストヘルプが出力される', () => {
    const { stdout, status } = runCli(['--help-human']);
    expect(status).toBe(0);
    expect(stdout).toContain('shirokuma-lint');
    expect(() => JSON.parse(stdout)).toThrow();
  });

  it('--pretty --help で JSON がインデントされる', () => {
    const { stdout, status } = runCli(['--pretty', '--help']);
    expect(status).toBe(0);
    expect(stdout.split('\n').length).toBeGreaterThan(2);
    const parsed = JSON.parse(stdout) as { cmd: string };
    expect(parsed.cmd).toContain('shirokuma-lint');
  });

  it('coverage --help でサブコマンド JSON ヘルプが出力される', () => {
    const { stdout, status } = runCli(['coverage', '--help']);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout) as { cmd: string };
    expect(parsed.cmd).toContain('coverage');
  });

  it('describe でコマンドツリー全体が出力される（deep dump）', () => {
    const { stdout, status } = runCli(['describe']);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout) as { cmd: string; sub: Array<{ cmd: string }> | null };
    expect(parsed.cmd).toContain('shirokuma-lint');
    const subNames = (parsed.sub ?? []).map((s) => s.cmd.split(' ').pop());
    expect(subNames).toContain('coverage');
    expect(subNames).toContain('docs');
    expect(subNames).toContain('structure');
    expect(subNames).toContain('code');
    expect(subNames).toContain('commit-format');
    expect(subNames).toContain('all');
    expect(subNames).toContain('describe');
  });

  it('引数なしで JSON ヘルプが出力される（exit 0）', () => {
    // 既存の default action は package 名を出力していたが、
    // preflightArgv（remainingArgv.length <= 2）で先に JSON ヘルプが出力される
    const { status } = runCli([]);
    expect(status).toBe(0);
  });

  it('--pretty フラグがサブコマンド結果に伝播する', () => {
    const { stdout, status } = runCli(['--pretty', 'coverage']);
    expect(status).toBe(0);
    // インデントがある（複数行）
    expect(stdout.split('\n').length).toBeGreaterThan(2);
    JSON.parse(stdout); // valid JSON
  });
});
