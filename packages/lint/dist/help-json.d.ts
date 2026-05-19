/**
 * AI 一次利用前提の CLI help / error JSON。
 *
 * - 出力先は常に stdout（gh / kubectl の structured output 規約）
 * - JSON は minified 既定（AI コンテキスト最小化が要件: ADR-v3-019）
 * - help は exit 0、エラーは exit 1
 *
 * Ported from shirokuma-flow@b797ddc packages/flow/src/lib/help-json.ts
 */
import type { Command, CommanderError } from 'commander';
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
export declare function commandPath(cmd: Command): string;
export declare function commandToJson(cmd: Command, opts?: {
    deep?: boolean;
}): CommandJson;
export declare function errorToJson(err: CommanderError | Error, cmd?: Command): ErrorJson;
export interface EmitOptions {
    pretty?: boolean;
    exitCode?: number;
}
export declare function emitJson(obj: unknown, opts?: EmitOptions): never;
/**
 * exitOverride() を有効化した Commander が「正常な制御フロー」のために投げる例外コード集。
 * これらは catch 側で「エラー」として JSON 化せず、保存された exitCode で素直に終了する。
 */
export declare const BENIGN_COMMANDER_CODES: ReadonlySet<string>;
export declare function isBenignCommanderError(err: CommanderError): boolean;
export interface PreflightResult {
    pretty: boolean;
    help: 'json' | 'human' | null;
    /**
     * `--version` / `-V` を検出したかどうか。
     * `walkCommands` が `configureOutput.writeOut` を空関数に置き換えるため Commander 標準の
     * version 表示が抑制される。各 CLI で `if (preflight.version)` を見て自前で出力する。
     */
    version: boolean;
    target: Command;
    remainingArgv: string[];
}
/**
 * argv を 1 パスで scan し、--pretty / --help / --help-human / --version を抽出 + 対象コマンド解決。
 * Commander parse 前に呼び、unknown option エラーを回避するために返り値の remainingArgv を渡す。
 * value-taking option（--locale ja 等）を正しく消費するため program.options を参照する。
 */
export declare function preflightArgv(argv: string[], root: Command): PreflightResult;
export declare function walkCommands(root: Command, fn: (cmd: Command) => void): void;
//# sourceMappingURL=help-json.d.ts.map