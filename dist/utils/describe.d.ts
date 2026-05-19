/**
 * コマンドスキーマ自己記述 (#1340)
 *
 * Commander.js の Command/Option メタデータから JSON スキーマを自動生成する。
 * 純粋関数のみで構成し、副作用（stdout 出力・process.exit）は呼び出し側に委ねる。
 */
import type { Command, Option } from "commander";
export interface OptionDescription {
    flags: string;
    name: string;
    description: string;
    required: boolean;
    mandatory: boolean;
    variadic: boolean;
    negate: boolean;
    defaultValue?: unknown;
    choices?: string[];
    inherited?: boolean;
}
export interface ArgumentDescription {
    name: string;
    description: string;
    required: boolean;
    variadic: boolean;
}
export interface CommandDescription {
    name: string;
    description: string;
    options: OptionDescription[];
    arguments?: ArgumentDescription[];
    subcommands?: {
        name: string;
        description: string;
    }[];
}
export interface ProgramCommandSummary {
    name: string;
    description: string;
    subcommands?: string[];
}
export interface ProgramDescription {
    name: string;
    version: string;
    commands: ProgramCommandSummary[];
}
/**
 * 単一 Option のメタデータを抽出する
 *
 * @param opt - Commander.js の Option オブジェクト
 * @param inherited - 親コマンドから継承されたオプションの場合 true
 * @returns オプションのメタデータ。defaultValue, choices, inherited は該当時のみ含む
 */
export declare function describeOption(opt: Option, inherited?: boolean): OptionDescription;
interface DescribeCommandOptions {
    includeInherited?: boolean;
}
/**
 * コマンドのオプション・引数・サブコマンドを JSON 形式で記述する
 *
 * @param cmd - Commander.js の Command オブジェクト
 * @param opts - オプション。includeInherited: true で親コマンドのオプションも収集する
 * @returns コマンドのメタデータ。arguments, subcommands は該当時のみ含む
 */
export declare function describeCommand(cmd: Command, opts?: DescribeCommandOptions): CommandDescription;
/**
 * トップレベルプログラムのコマンド一覧を簡潔に記述する
 *
 * @param program - Commander.js のルート Command オブジェクト
 * @param version - CLI バージョン文字列
 * @returns プログラムのメタデータ（コマンド名・説明・サブコマンド名の一覧）
 */
export declare function describeProgram(program: Command, version: string): ProgramDescription;
export {};
//# sourceMappingURL=describe.d.ts.map