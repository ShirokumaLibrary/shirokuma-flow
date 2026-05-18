#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, resolve } from 'node:path';
import { Command, CommanderError } from 'commander';
import { parse as parseYaml } from 'yaml';
import { PACKAGE_NAME } from './index.js';
import { determineLintExitCode } from './exit-code.js';
import { lintCoverage } from './coverage.js';
import { lintDocs } from './docs.js';
import { lintStructure } from './structure.js';
import { lintCode } from './code.js';
import { lintCommitFormat } from './commit-format.js';
import { readFile } from './file.js';
import { validateProjectPath } from './sanitize.js';
import { discoverProjectRoot, resolveAutoConfigPath } from './project-root.js';
import type { LintDocsConfig } from './docs-types.js';
import type { LintStructureConfig } from './structure-types.js';
import type { LintCodeConfig } from './code-types.js';
import type { LintCommitFormatConfig } from './commit-format-types.js';
import {
  commandToJson,
  emitJson,
  errorToJson,
  isBenignCommanderError,
  preflightArgv,
  walkCommands,
} from './help-json.js';

interface GlobalOpts {
  project?: string;
  projectRoot?: string;
  strict?: boolean;
}

// preflightArgv から取得する pretty を全 action から参照するため、let で先行宣言する。
// action は parseAsync 中に呼ばれるため、その時点で代入済みの値が見える。
let pretty = false;

function writeJson(value: unknown, pretty: boolean): void {
  const body = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  process.stdout.write(body + '\n');
}

function resolveProject(raw: string | undefined): string {
  return validateProjectPath(raw ?? process.cwd());
}

function parseJsonOrExit<T>(json: string, label: string, pretty: boolean): T {
  try {
    return JSON.parse(json) as T;
  } catch (err) {
    emitJson(
      { error: `invalid ${label} JSON: ${err instanceof Error ? err.message : String(err)}` },
      { exitCode: 1, pretty },
    );
  }
}

function parseConfigFileOrExit<T>(filePath: string, label: string, pretty: boolean): T {
  const content = readFile(filePath);
  if (content === null) {
    emitJson({ error: `${label}: file not found: ${filePath}` }, { exitCode: 1, pretty });
  }
  const ext = extname(filePath).toLowerCase();
  try {
    if (ext === '.yaml' || ext === '.yml') return parseYaml(content) as T;
    if (ext === '.json') return JSON.parse(content) as T;
    emitJson(
      { error: `${label}: unsupported extension "${ext}" (use .yaml / .yml / .json)` },
      { exitCode: 1, pretty },
    );
  } catch (err) {
    emitJson(
      {
        error: `${label}: parse error in ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      },
      { exitCode: 1, pretty },
    );
  }
}

/**
 * `--<flag>` (inline JSON) / `--<flag>-file` (YAML/JSON path) のいずれか一方から config を取得。
 * 両方指定 / どちらも無しはエラー終了。ADR-0012 の JSON error envelope で exit(1)。
 */
function loadConfigOrExit<T>(
  inline: string | undefined,
  file: string | undefined,
  flag: string,
  pretty: boolean,
): T {
  const inlineLabel = `--${flag}`;
  const fileLabel = `--${flag}-file`;
  if (inline !== undefined && file !== undefined) {
    emitJson(
      { error: `${inlineLabel} and ${fileLabel} are mutually exclusive` },
      { exitCode: 1, pretty },
    );
  }
  if (inline !== undefined) return parseJsonOrExit<T>(inline, inlineLabel, pretty);
  if (file !== undefined) return parseConfigFileOrExit<T>(file, fileLabel, pretty);
  emitJson({ error: `${inlineLabel} or ${fileLabel} is required` }, { exitCode: 1, pretty });
}

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('shirokuma-lint')
  .description('AI 向けドキュメント / コード構造のファイルレベル lint')
  .version(version)
  .option('--project <path>', 'プロジェクトルート（既定: cwd）')
  .option(
    '--project-root <path>',
    'monorepo root（`.shirokuma/` を持つディレクトリ）。未指定時は --project から walk up で auto-discover (Issue #49)',
  )
  .option('--strict', 'error が 1 件でもあれば exit 1（pass/warning のみなら 0）')
  .action(() => {
    writeJson({ package: PACKAGE_NAME }, pretty);
  });

program
  .command('coverage')
  .description('実装ファイルとテストファイルの対応をチェック')
  .action(() => {
    const opts = program.opts<GlobalOpts>();
    const projectPath = resolveProject(opts.project);
    const report = lintCoverage({ projectPath });
    writeJson(report, pretty);
    process.exit(determineLintExitCode(report.passed, opts.strict ?? false));
  });

program
  .command('docs')
  .description('Markdown 文書の構造（セクション / 長さ / frontmatter / 内部リンク）を検証')
  .option(
    '--config <json>',
    'LintDocsConfig JSON（例: \'{"required":[{"file":"README.md","description":"..."}]}\'）',
  )
  .option('--config-file <path>', 'LintDocsConfig を格納した YAML / JSON ファイルパス')
  .action((cmdOpts: { config?: string; configFile?: string }) => {
    const opts = program.opts<GlobalOpts>();
    const projectPath = resolveProject(opts.project);
    const parsed = loadConfigOrExit<LintDocsConfig>(
      cmdOpts.config,
      cmdOpts.configFile,
      'config',
      pretty,
    );
    const report = lintDocs({ projectPath, config: parsed });
    writeJson(report, pretty);
    process.exit(determineLintExitCode(report.passed, opts.strict ?? false));
  });

program
  .command('structure')
  .description('プロジェクト構造（必須 / 推奨ディレクトリ / 必須ファイル）を検証')
  .option('--config <json>', 'LintStructureConfig JSON（例: \'{"dirRequired":["src","tests"]}\'）')
  .option('--config-file <path>', 'LintStructureConfig を格納した YAML / JSON ファイルパス')
  .action((cmdOpts: { config?: string; configFile?: string }) => {
    const opts = program.opts<GlobalOpts>();
    const projectPath = resolveProject(opts.project);
    const parsed = loadConfigOrExit<LintStructureConfig>(
      cmdOpts.config,
      cmdOpts.configFile,
      'config',
      pretty,
    );
    const report = lintStructure({ projectPath, config: parsed });
    writeJson(report, pretty);
    process.exit(determineLintExitCode(report.passed, opts.strict ?? false));
  });

program
  .command('code')
  .description('TypeScript コードの JSDoc タグ必須性を検証')
  .option(
    '--config <json>',
    'LintCodeConfig JSON（例: \'{"rules":[{"filePattern":"src/**/*.ts","functionTags":["@returns"]}]}\'）',
  )
  .option('--config-file <path>', 'LintCodeConfig を格納した YAML / JSON ファイルパス')
  .action((cmdOpts: { config?: string; configFile?: string }) => {
    const opts = program.opts<GlobalOpts>();
    const projectPath = resolveProject(opts.project);
    const parsed = loadConfigOrExit<LintCodeConfig>(
      cmdOpts.config,
      cmdOpts.configFile,
      'config',
      pretty,
    );
    const report = lintCode({ projectPath, config: parsed });
    writeJson(report, pretty);
    process.exit(determineLintExitCode(report.passed, opts.strict ?? false));
  });

program
  .command('commit-format')
  .description('commit メッセージが Conventional Commits に沿うか検証')
  .option(
    '--config <json>',
    'LintCommitFormatConfig JSON（例: \'{"commits":[{"hash":"abc","subject":"feat: x"}]}\'）',
  )
  .option('--config-file <path>', 'LintCommitFormatConfig を格納した YAML / JSON ファイルパス')
  .action((cmdOpts: { config?: string; configFile?: string }) => {
    const opts = program.opts<GlobalOpts>();
    const parsed = loadConfigOrExit<LintCommitFormatConfig>(
      cmdOpts.config,
      cmdOpts.configFile,
      'config',
      pretty,
    );
    const report = lintCommitFormat({ config: parsed });
    writeJson(report, pretty);
    process.exit(determineLintExitCode(report.passed, opts.strict ?? false));
  });

interface AllCmdOpts {
  docsConfig?: string;
  docsConfigFile?: string;
  structureConfig?: string;
  structureConfigFile?: string;
  codeConfig?: string;
  codeConfigFile?: string;
  commitFormatConfig?: string;
  commitFormatConfigFile?: string;
}

program
  .command('all')
  .description(
    'coverage + (structure は --project-root 配下 .shirokuma/lint/structure.yaml を auto-discover、 docs|code|commit-format は --config / --config-file 指定時のみ) を一括実行',
  )
  .option('--docs-config <json>', 'docs 用 LintDocsConfig JSON')
  .option('--docs-config-file <path>', 'docs 用 LintDocsConfig を格納した YAML / JSON ファイル')
  .option('--structure-config <json>', 'structure 用 LintStructureConfig JSON')
  .option(
    '--structure-config-file <path>',
    'structure 用 LintStructureConfig を格納した YAML / JSON ファイル',
  )
  .option('--code-config <json>', 'code 用 LintCodeConfig JSON')
  .option('--code-config-file <path>', 'code 用 LintCodeConfig を格納した YAML / JSON ファイル')
  .option('--commit-format-config <json>', 'commit-format 用 LintCommitFormatConfig JSON')
  .option(
    '--commit-format-config-file <path>',
    'commit-format 用 LintCommitFormatConfig を格納した YAML / JSON ファイル',
  )
  .action((cmdOpts: AllCmdOpts) => {
    const opts = program.opts<GlobalOpts>();
    const projectPath = resolveProject(opts.project);
    let projectRoot: string | null;
    if (opts.projectRoot !== undefined) {
      projectRoot = resolve(opts.projectRoot);
      if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) {
        emitJson(
          {
            error: `--project-root: directory not found: ${projectRoot}`,
            help_hint:
              'pass an existing directory that contains .shirokuma/, or omit to auto-discover',
          },
          { exitCode: 1, pretty },
        );
      }
    } else {
      projectRoot = discoverProjectRoot(projectPath);
    }

    const results: Record<string, unknown> = {};
    let anyFailed = false;

    // Auto-discovery is scoped to rules that apply per-package naturally.
    // Structure rules describe "every package should have src/, tests/, ..."
    // and benefit from running unchanged across every workspace. Docs / code /
    // commit-format rules are typically repo-wide (README.md length, ADR shape,
    // commit format) and must stay explicit to avoid cross-package misfires
    // (a package's short README triggering monorepo-level length rules).
    const AUTO_DISCOVER_RULES = new Set(['structure']);

    function runIfConfigured<T>(
      resultKey: string,
      flag: string,
      ruleName: string,
      inline: string | undefined,
      file: string | undefined,
      run: (config: T) => { passed: boolean },
    ): void {
      let effectiveFile = file;
      if (inline === undefined && effectiveFile === undefined) {
        if (!AUTO_DISCOVER_RULES.has(ruleName)) return;
        const auto = resolveAutoConfigPath(projectRoot, ruleName);
        if (auto === null) return;
        effectiveFile = auto;
      }
      const parsed = loadConfigOrExit<T>(inline, effectiveFile, flag, pretty);
      const report = run(parsed);
      results[resultKey] = report;
      if (!report.passed) anyFailed = true;
    }

    const coverageReport = lintCoverage({ projectPath });
    results.coverage = coverageReport;
    if (!coverageReport.passed) anyFailed = true;

    runIfConfigured<LintDocsConfig>(
      'docs',
      'docs-config',
      'docs',
      cmdOpts.docsConfig,
      cmdOpts.docsConfigFile,
      (config) => lintDocs({ projectPath, config }),
    );
    runIfConfigured<LintStructureConfig>(
      'structure',
      'structure-config',
      'structure',
      cmdOpts.structureConfig,
      cmdOpts.structureConfigFile,
      (config) => lintStructure({ projectPath, config }),
    );
    runIfConfigured<LintCodeConfig>(
      'code',
      'code-config',
      'code',
      cmdOpts.codeConfig,
      cmdOpts.codeConfigFile,
      (config) => lintCode({ projectPath, config }),
    );
    runIfConfigured<LintCommitFormatConfig>(
      'commitFormat',
      'commit-format-config',
      'commit-format',
      cmdOpts.commitFormatConfig,
      cmdOpts.commitFormatConfigFile,
      (config) => lintCommitFormat({ config }),
    );

    writeJson({ passed: !anyFailed, results }, pretty);
    process.exit(determineLintExitCode(!anyFailed, opts.strict ?? false));
  });

// describe サブコマンド: コマンドツリー全体を JSON でダンプ（AI ディスカバリー用）
program
  .command('describe')
  .description('Dump the entire command tree as JSON (AI discovery entry point)')
  .action(() => {
    emitJson(commandToJson(program, { deep: true }), { pretty });
  });

// JSON help / human help の統合（ADR-v3-019）
walkCommands(program, (cmd) => {
  cmd.helpOption(false);
  cmd.addHelpCommand(false);
  cmd.option('--help', 'AI-readable JSON help (default for AI consumers)');
  cmd.option('--help-human, -H', 'Human-readable text help (emergency only)');
  cmd.exitOverride();
  cmd.configureOutput({ writeOut: () => {}, writeErr: () => {}, outputError: () => {} });
});

const preflight = preflightArgv(process.argv, program);
pretty = preflight.pretty;
const { help, target, remainingArgv } = preflight;

if (preflight.version) {
  process.stdout.write(version + '\n');
  process.exit(0);
}
if (help === 'json') {
  emitJson(commandToJson(target), { pretty });
}
if (help === 'human') {
  process.stdout.write(target.helpInformation());
  process.exit(0);
}
if (remainingArgv.length <= 2) {
  emitJson(commandToJson(program, { deep: true }), { pretty });
}

program.parseAsync(remainingArgv).catch((err: unknown) => {
  if (err instanceof CommanderError) {
    if (isBenignCommanderError(err)) {
      process.exit(err.exitCode ?? 0);
    }
    emitJson(errorToJson(err, target), { pretty, exitCode: 1 });
    return;
  }
  emitJson(errorToJson(err instanceof Error ? err : new Error(String(err))), {
    pretty,
    exitCode: 1,
  });
});
