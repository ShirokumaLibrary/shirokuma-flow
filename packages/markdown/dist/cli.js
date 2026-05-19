#!/usr/bin/env node
/**
 * shirokuma-md CLI エントリポイント
 *
 * `packages/flow/src/commands/md/program.ts` の md コマンドを独立バイナリとして提供。
 */
import { createRequire } from 'node:module';
import { Command, CommanderError } from 'commander';
import { createMdCommand } from './commands/md/program.js';
import { commandToJson as _commandToJson, emitJson, errorToJson as _errorToJson, isBenignCommanderError, preflightArgv as _preflightArgv, walkCommands as _walkCommands, } from '@shirokuma-library/lint/help-json';
function commandToJson(cmd, opts) {
    return _commandToJson(cmd, opts);
}
function errorToJson(err, cmd) {
    return _errorToJson(err, cmd);
}
function preflightArgv(argv, root) {
    return _preflightArgv(argv, root);
}
function walkCommands(root, fn) {
    _walkCommands(root, fn);
}
const require = createRequire(import.meta.url);
const { version } = require('../package.json');
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
    cmd.configureOutput({ writeOut: () => { }, writeErr: () => { }, outputError: () => { } });
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
program.parseAsync(remainingArgv).catch((err) => {
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
//# sourceMappingURL=cli.js.map