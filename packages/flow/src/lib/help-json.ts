/**
 * flow パッケージ用 help-json ブリッジ。
 *
 * @shirokuma-library/lint/help-json（commander@12 型）を commander@14 の
 * Command インスタンスで利用するためのラッパー。実行時 API は互換性あり。
 *
 * Ported from shirokuma-flow@b797ddc packages/flow/src/lib/help-json.ts
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCommand = any;

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

export interface EmitOptions {
  pretty?: boolean;
  exitCode?: number;
}

export interface PreflightResult {
  pretty: boolean;
  help: 'json' | 'human' | null;
  /**
   * `--version` / `-V` を検出したかどうか。
   * `walkCommands` が `writeOut` を空関数化するため Commander 標準の version 表示が抑制される。
   * 各 CLI で `if (preflight.version)` を見て自前で出力する。
   */
  version: boolean;
  target: AnyCommand;
  remainingArgv: string[];
}

// lint/help-json から実装をインポートし、commander@14 の型に対応するためキャスト
import {
  commandToJson as _commandToJson,
  errorToJson as _errorToJson,
  emitJson,
  preflightArgv as _preflightArgv,
  walkCommands as _walkCommands,
  BENIGN_COMMANDER_CODES,
  isBenignCommanderError as _isBenignCommanderError,
} from '@shirokuma-library/lint/help-json';

export { emitJson, BENIGN_COMMANDER_CODES };

export function isBenignCommanderError(err: AnyCommand): boolean {
  return _isBenignCommanderError(err);
}

export function commandToJson(cmd: AnyCommand, opts: { deep?: boolean } = {}): CommandJson {
  return _commandToJson(cmd, opts) as CommandJson;
}

export function errorToJson(err: Error, cmd?: AnyCommand): ErrorJson {
  return _errorToJson(err, cmd) as ErrorJson;
}

export function preflightArgv(argv: string[], root: AnyCommand): PreflightResult {
  return _preflightArgv(argv, root) as PreflightResult;
}

export function walkCommands(root: AnyCommand, fn: (cmd: AnyCommand) => void): void {
  _walkCommands(root, fn);
}
