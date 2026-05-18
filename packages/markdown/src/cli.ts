#!/usr/bin/env node
/**
 * shirokuma-md CLI エントリポイント
 *
 * `packages/flow/src/commands/md/program.ts` の md コマンドを独立バイナリとして提供。
 */

import { createRequire } from 'node:module';
import { Command, CommanderError } from 'commander';
import { createMdCommand } from './commands/md/program.js';

// commander@14 と lint パッケージ（commander@12）の型衝突を避けるため、
// lint/help-json の関数を any キャスト経由でブリッジする
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCommand = any;
import {
  commandToJson as _commandToJson,
  emitJson,
  errorToJson as _errorToJson,
  isBenignCommanderError,
  preflightArgv as _preflightArgv,
  walkCommands as _walkCommands,
  type CommandJson,
  type ErrorJson,
  type PreflightResult,
} from '@shirokuma-library/lint/help-json';

function commandToJson(cmd: AnyCommand, opts?: { deep?: boolean }): CommandJson {
  return _commandToJson(cmd, opts);
}
function errorToJson(err: Error, cmd?: AnyCommand): ErrorJson {
  return _errorToJson(err, cmd);
}
function preflightArgv(argv: string[], root: AnyCommand): PreflightResult {
  return _preflightArgv(argv, root);
}
function walkCommands(root: AnyCommand, fn: (cmd: AnyCommand) => void): void {
  _walkCommands(root, fn);
}

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command();
program.name('shirokuma-md').version(version);

program.addCommand(createMdCommand());

// preflightArgv から取得する pretty を describe action から参照するため、let で先行宣言する。
// describe action は parseAsync 中に呼ばれるため、その時点で代入済みの値が見える。
let pretty = false;

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
