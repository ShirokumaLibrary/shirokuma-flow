import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFile } from '../src/file.js';

const CLI_ENTRY = resolve(__dirname, '../src/cli.ts');
const TSX_BIN = resolve(__dirname, '..', 'node_modules', '.bin', 'tsx');

function runCli(args: string[]): { stdout: string; status: number | null } {
  const result = spawnSync(TSX_BIN, [CLI_ENTRY, ...args], { encoding: 'utf-8' });
  return { stdout: result.stdout, status: result.status };
}

describe('shirokuma-lint CLI', () => {
  let project: string;
  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), 'lint-cli-'));
  });
  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it('default action（引数なし）はコマンドツリー JSON を返す（ADR-v3-019）', () => {
    // 引数なしの場合は preflightArgv が commandToJson(program, { deep: true }) を出力する
    const { stdout, status } = runCli([]);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout) as { cmd: string; sub: unknown[] | null };
    expect(parsed.cmd).toContain('shirokuma-lint');
    expect(parsed.sub).not.toBeNull();
  });

  it('--pretty でコマンドツリー JSON がインデントされる', () => {
    const { stdout } = runCli(['--pretty']);
    expect(stdout.split('\n').length).toBeGreaterThan(2);
    JSON.parse(stdout); // valid JSON
  });

  it('coverage subcommand returns CoverageReport JSON and exits 0 when empty', () => {
    const { stdout, status } = runCli(['--project', project, 'coverage']);
    expect(status).toBe(0);
    const report = JSON.parse(stdout) as { passed: boolean };
    expect(report.passed).toBe(true);
  });

  it('coverage --strict exits 1 on missing tests', () => {
    writeFile(join(project, 'src/a.ts'), 'export const a = 1;');
    const { status } = runCli(['--project', project, '--strict', 'coverage']);
    expect(status).toBe(1);
  });

  it('structure subcommand passes with valid config', () => {
    writeFile(join(project, 'src/a.ts'), '');
    const { stdout, status } = runCli([
      '--project',
      project,
      'structure',
      '--config',
      JSON.stringify({ dirRequired: ['src'] }),
    ]);
    expect(status).toBe(0);
    const report = JSON.parse(stdout) as { passed: boolean };
    expect(report.passed).toBe(true);
  });

  it('structure --strict exits 1 when dirRequired missing', () => {
    const { status } = runCli([
      '--project',
      project,
      '--strict',
      'structure',
      '--config',
      JSON.stringify({ dirRequired: ['does-not-exist'] }),
    ]);
    expect(status).toBe(1);
  });

  it('code subcommand passes with empty rules', () => {
    const { stdout, status } = runCli([
      '--project',
      project,
      'code',
      '--config',
      JSON.stringify({ rules: [] }),
    ]);
    expect(status).toBe(0);
    const report = JSON.parse(stdout) as { passed: boolean };
    expect(report.passed).toBe(true);
  });

  it('code --strict exits 1 when required function tag missing', () => {
    writeFile(join(project, 'src/a.ts'), 'export function foo() {}\n');
    const { status } = runCli([
      '--project',
      project,
      '--strict',
      'code',
      '--config',
      JSON.stringify({
        rules: [{ filePattern: 'src/**/*.ts', functionTags: ['@returns'] }],
      }),
    ]);
    expect(status).toBe(1);
  });

  it('commit-format subcommand passes valid conventional commit', () => {
    const { stdout, status } = runCli([
      'commit-format',
      '--config',
      JSON.stringify({ commits: [{ hash: 'abc1234', subject: 'feat: ok' }] }),
    ]);
    expect(status).toBe(0);
    const report = JSON.parse(stdout) as { passed: boolean };
    expect(report.passed).toBe(true);
  });

  it('commit-format --strict + severity=error exits 1 on non-conventional', () => {
    const { status } = runCli([
      '--strict',
      'commit-format',
      '--config',
      JSON.stringify({
        commits: [{ hash: 'abc1234', subject: 'oops' }],
        severity: 'error',
      }),
    ]);
    expect(status).toBe(1);
  });

  it('docs subcommand rejects invalid --config JSON via error envelope', () => {
    const { stdout, status } = runCli(['--project', project, 'docs', '--config', 'not-json']);
    expect(status).toBe(1);
    const body = JSON.parse(stdout) as { error: string };
    expect(body.error).toContain('invalid --config JSON');
  });

  it('code --config-file reads YAML', () => {
    writeFile(join(project, '.shirokuma/lint/code.yaml'), 'rules: []\n');
    const { stdout, status } = runCli([
      '--project',
      project,
      'code',
      '--config-file',
      join(project, '.shirokuma/lint/code.yaml'),
    ]);
    expect(status).toBe(0);
    const body = JSON.parse(stdout) as { passed: boolean };
    expect(body.passed).toBe(true);
  });

  it('code --config-file reads JSON', () => {
    writeFile(join(project, '.shirokuma/lint/code.json'), JSON.stringify({ rules: [] }));
    const { status } = runCli([
      '--project',
      project,
      'code',
      '--config-file',
      join(project, '.shirokuma/lint/code.json'),
    ]);
    expect(status).toBe(0);
  });

  it('code --config-file errors on missing file', () => {
    const { stdout, status } = runCli([
      '--project',
      project,
      'code',
      '--config-file',
      join(project, 'missing.yaml'),
    ]);
    expect(status).toBe(1);
    const body = JSON.parse(stdout) as { error: string };
    expect(body.error).toContain('file not found');
  });

  it('code --config-file errors on unsupported extension', () => {
    writeFile(join(project, 'code.txt'), 'rules: []');
    const { stdout, status } = runCli([
      '--project',
      project,
      'code',
      '--config-file',
      join(project, 'code.txt'),
    ]);
    expect(status).toBe(1);
    const body = JSON.parse(stdout) as { error: string };
    expect(body.error).toContain('unsupported extension');
  });

  it('code --config-file errors on malformed YAML', () => {
    writeFile(join(project, 'bad.yaml'), 'rules: [unclosed\n');
    const { stdout, status } = runCli([
      '--project',
      project,
      'code',
      '--config-file',
      join(project, 'bad.yaml'),
    ]);
    expect(status).toBe(1);
    const body = JSON.parse(stdout) as { error: string };
    expect(body.error).toContain('parse error');
  });

  it('code errors when neither --config nor --config-file is given', () => {
    const { stdout, status } = runCli(['--project', project, 'code']);
    expect(status).toBe(1);
    const body = JSON.parse(stdout) as { error: string };
    expect(body.error).toContain('--config or --config-file is required');
  });

  it('code errors when both --config and --config-file are given', () => {
    writeFile(join(project, 'code.yaml'), 'rules: []\n');
    const { stdout, status } = runCli([
      '--project',
      project,
      'code',
      '--config',
      JSON.stringify({ rules: [] }),
      '--config-file',
      join(project, 'code.yaml'),
    ]);
    expect(status).toBe(1);
    const body = JSON.parse(stdout) as { error: string };
    expect(body.error).toContain('mutually exclusive');
  });

  it('all accepts --code-config-file YAML', () => {
    writeFile(join(project, 'src/a.ts'), '/**\n * @module a\n */\nexport const a = 1;\n');
    writeFile(join(project, 'tests/a.test.ts'), 'it("a", () => {});');
    writeFile(
      join(project, 'code.yaml'),
      'rules:\n  - filePattern: src/**/*.ts\n    moduleTags:\n      - "@module"\n',
    );
    const { stdout, status } = runCli([
      '--project',
      project,
      'all',
      '--code-config-file',
      join(project, 'code.yaml'),
    ]);
    expect(status).toBe(0);
    const body = JSON.parse(stdout) as { results: { code: unknown } };
    expect(body.results.code).toBeDefined();
  });

  it('all runs coverage and skips docs/structure when configs omitted', () => {
    writeFile(join(project, 'src/a.ts'), 'export const a = 1;');
    writeFile(join(project, 'tests/a.test.ts'), 'it("a", () => {});');
    const { stdout, status } = runCli(['--project', project, 'all']);
    expect(status).toBe(0);
    const body = JSON.parse(stdout) as {
      passed: boolean;
      results: { coverage: unknown; docs?: unknown; structure?: unknown };
    };
    expect(body.passed).toBe(true);
    expect(body.results.coverage).toBeDefined();
    expect(body.results.docs).toBeUndefined();
    expect(body.results.structure).toBeUndefined();
  });

  it('all runs all five when configs provided', () => {
    writeFile(join(project, 'src/a.ts'), '/**\n * @module a\n */\nexport const a = 1;\n');
    writeFile(join(project, 'tests/a.test.ts'), 'it("a", () => {});');
    writeFile(join(project, 'README.md'), '# Title\nbody');
    const { stdout, status } = runCli([
      '--project',
      project,
      'all',
      '--docs-config',
      JSON.stringify({ required: [{ file: 'README.md', description: 'r' }] }),
      '--structure-config',
      JSON.stringify({ dirRequired: ['src'] }),
      '--code-config',
      JSON.stringify({
        rules: [{ filePattern: 'src/**/*.ts', moduleTags: ['@module'] }],
      }),
      '--commit-format-config',
      JSON.stringify({ commits: [{ hash: 'abc1234', subject: 'feat: ok' }] }),
    ]);
    expect(status).toBe(0);
    const body = JSON.parse(stdout) as {
      results: {
        coverage: unknown;
        docs: unknown;
        structure: unknown;
        code: unknown;
        commitFormat: unknown;
      };
    };
    expect(body.results.coverage).toBeDefined();
    expect(body.results.docs).toBeDefined();
    expect(body.results.structure).toBeDefined();
    expect(body.results.code).toBeDefined();
    expect(body.results.commitFormat).toBeDefined();
  });

  it('--strict in all propagates any failure to exit 1', () => {
    const { status } = runCli([
      '--project',
      project,
      '--strict',
      'all',
      '--structure-config',
      JSON.stringify({ dirRequired: ['does-not-exist'] }),
    ]);
    expect(status).toBe(1);
  });
});
