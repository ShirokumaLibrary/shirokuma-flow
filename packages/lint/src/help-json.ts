/**
 * AI 一次利用前提の CLI help / error JSON。
 *
 * - 出力先は常に stdout（gh / kubectl の structured output 規約）
 * - JSON は minified 既定（AI コンテキスト最小化が要件: ADR-v3-019）
 * - help は exit 0、エラーは exit 1
 *
 * Ported from shirokuma-flow@b797ddc packages/flow/src/lib/help-json.ts
 */
import type { Command, CommanderError, Option } from 'commander';

export interface OptionJson {
  flag: string;
  desc: string;
  required?: boolean;
  bool?: boolean;
  default?: unknown;
}

export interface ArgJson {
  name: string;
  desc?: string;
  required: boolean;
  variadic?: boolean;
}

export interface CommandJson {
  cmd: string;
  desc: string;
  args: ArgJson[];
  opts: OptionJson[];
  sub: CommandJson[] | null;
  examples?: string[];
}

export interface ErrorJson {
  error: string;
  message: string;
  command?: string;
  suggestion?: string;
  available_commands?: string[];
  available_options?: string[];
  help_hint: string;
}

const HELP_HINT =
  "Run '<command> --help' for AI-readable JSON, or '<command> --help-human' for verbose text.";

const HELP_FLAGS = new Set(['--help', '-h', '--help-human', '-H']);

function optionKey(o: Option): string {
  return o.long ?? o.short ?? '';
}

function shallowSubNode(c: Command): CommandJson {
  return { cmd: c.name(), desc: c.description(), args: [], opts: [], sub: null };
}

function visibleSubCommands(cmd: Command): Command[] {
  return cmd.commands.filter((c) => !c.name().startsWith('help'));
}

export function commandPath(cmd: Command): string {
  const names: string[] = [];
  let c: Command | null = cmd;
  while (c) {
    names.unshift(c.name());
    c = c.parent ?? null;
  }
  return names.join(' ');
}

export function commandToJson(cmd: Command, opts: { deep?: boolean } = {}): CommandJson {
  const args: ArgJson[] = cmd.registeredArguments.map((a) => ({
    name: a.name(),
    desc: a.description || undefined,
    required: a.required,
    variadic: a.variadic || undefined,
  }));

  const optsJson: OptionJson[] = cmd.options
    .filter((o) => !HELP_FLAGS.has(optionKey(o)))
    .map((o) => {
      const entry: OptionJson = { flag: o.flags, desc: o.description };
      if (o.required) entry.required = true;
      if (o.isBoolean()) entry.bool = true;
      if (o.defaultValue !== undefined) entry.default = o.defaultValue;
      return entry;
    });

  const subs = visibleSubCommands(cmd);
  let sub: CommandJson[] | null = null;
  if (subs.length > 0) {
    sub = opts.deep ? subs.map((c) => commandToJson(c, { deep: true })) : subs.map(shallowSubNode);
  }

  return { cmd: commandPath(cmd), desc: cmd.description(), args, opts: optsJson, sub };
}

export function errorToJson(err: CommanderError | Error, cmd?: Command): ErrorJson {
  const cmdPath = cmd ? commandPath(cmd) : undefined;
  const code = (err as CommanderError).code;

  const base: ErrorJson = {
    error: code ?? 'runtime_error',
    message: err.message,
    help_hint: HELP_HINT,
  };
  if (cmdPath) base.command = cmdPath;

  if (cmd) {
    if (code === 'commander.unknownCommand') {
      base.available_commands = visibleSubCommands(cmd).map((c) => c.name());
    }
    if (code === 'commander.unknownOption') {
      base.available_options = cmd.options.map(optionKey).filter(Boolean);
    }
    if (
      code === 'commander.missingArgument' ||
      code === 'commander.missingMandatoryOptionValue' ||
      code === 'commander.invalidArgument'
    ) {
      base.help_hint = `Run '${cmdPath} --help' for available arguments and options.`;
    }
  }

  return base;
}

export interface EmitOptions {
  pretty?: boolean;
  exitCode?: number;
}

export function emitJson(obj: unknown, opts: EmitOptions = {}): never {
  const json = opts.pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
  process.stdout.write(json + '\n');
  process.exit(opts.exitCode ?? 0);
}

/**
 * exitOverride() を有効化した Commander が「正常な制御フロー」のために投げる例外コード集。
 * これらは catch 側で「エラー」として JSON 化せず、保存された exitCode で素直に終了する。
 */
export const BENIGN_COMMANDER_CODES: ReadonlySet<string> = new Set([
  'commander.helpDisplayed',
  'commander.help',
  'commander.version',
]);

export function isBenignCommanderError(err: CommanderError): boolean {
  return BENIGN_COMMANDER_CODES.has(err.code);
}

export interface PreflightResult {
  pretty: boolean;
  help: 'json' | 'human' | null;
  target: Command;
  remainingArgv: string[];
}

/**
 * argv を 1 パスで scan し、--pretty / --help / --help-human を抽出 + 対象コマンド解決。
 * Commander parse 前に呼び、unknown option エラーを回避するために返り値の remainingArgv を渡す。
 * value-taking option（--locale ja 等）を正しく消費するため program.options を参照する。
 */
export function preflightArgv(argv: string[], root: Command): PreflightResult {
  let pretty = false;
  let help: 'json' | 'human' | null = null;
  const positional: string[] = [];
  const remaining: string[] = argv.slice(0, 2);

  // value-taking option のフラグセットを構築（--locale ja のような形式を正しく処理するため）
  const valueTakingFlags = new Set<string>();
  for (const opt of root.options) {
    if (!opt.isBoolean()) {
      if (opt.long) valueTakingFlags.add(opt.long);
      if (opt.short) valueTakingFlags.add(opt.short);
    }
  }

  let skipNext = false;
  const tokens = argv.slice(2);
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i];

    // 前のトークンが value-taking option だった場合、このトークンはその値
    if (skipNext) {
      skipNext = false;
      remaining.push(a);
      continue;
    }

    if (a === '--pretty') {
      pretty = true;
      continue;
    }
    if (a === '--help') {
      help ??= 'json';
      remaining.push(a);
      continue;
    }
    if (a === '--help-human' || a === '-H') {
      help ??= 'human';
      remaining.push(a);
      continue;
    }

    // value-taking option は次のトークンをスキップ（positional 誤検出防止）
    if (valueTakingFlags.has(a)) {
      skipNext = true;
      remaining.push(a);
      continue;
    }

    if (!a.startsWith('-')) positional.push(a);
    remaining.push(a);
  }

  let target: Command = root;
  for (const token of positional) {
    const next = target.commands.find((c) => c.name() === token || c.aliases().includes(token));
    if (!next) break;
    target = next;
  }

  return { pretty, help, target, remainingArgv: remaining };
}

export function walkCommands(root: Command, fn: (cmd: Command) => void): void {
  fn(root);
  for (const sub of root.commands) walkCommands(sub, fn);
}
