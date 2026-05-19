/**
 * コマンドスキーマ自己記述 (#1340)
 *
 * Commander.js の Command/Option メタデータから JSON スキーマを自動生成する。
 * 純粋関数のみで構成し、副作用（stdout 出力・process.exit）は呼び出し側に委ねる。
 */
// =============================================================================
// ヘルパー
// =============================================================================
/**
 * コマンドのフルパス名を構築する（例: "issues list"）
 * ルートプログラム名は含めない。
 */
function getCommandFullName(cmd) {
    const parts = [];
    let current = cmd;
    while (current) {
        // ルートプログラム（parent === null）は除外
        if (current.parent) {
            parts.unshift(current.name());
        }
        current = current.parent;
    }
    return parts.join(" ");
}
// =============================================================================
// 組み込みオプション除外
// =============================================================================
const BUILTIN_OPTION_NAMES = new Set(["help", "version"]);
function isBuiltinOption(opt) {
    return BUILTIN_OPTION_NAMES.has(opt.attributeName());
}
// =============================================================================
// describeOption
// =============================================================================
/**
 * 単一 Option のメタデータを抽出する
 *
 * @param opt - Commander.js の Option オブジェクト
 * @param inherited - 親コマンドから継承されたオプションの場合 true
 * @returns オプションのメタデータ。defaultValue, choices, inherited は該当時のみ含む
 */
export function describeOption(opt, inherited) {
    const result = {
        flags: opt.flags,
        name: opt.attributeName(),
        description: opt.description,
        required: opt.required,
        mandatory: opt.mandatory,
        variadic: opt.variadic,
        negate: opt.negate,
    };
    if (opt.defaultValue !== undefined) {
        result.defaultValue = opt.defaultValue;
    }
    if (opt.argChoices && opt.argChoices.length > 0) {
        result.choices = opt.argChoices;
    }
    if (inherited) {
        result.inherited = true;
    }
    return result;
}
/**
 * コマンドのオプション・引数・サブコマンドを JSON 形式で記述する
 *
 * @param cmd - Commander.js の Command オブジェクト
 * @param opts - オプション。includeInherited: true で親コマンドのオプションも収集する
 * @returns コマンドのメタデータ。arguments, subcommands は該当時のみ含む
 */
export function describeCommand(cmd, opts) {
    // 自身のオプション（組み込み除外）
    const options = cmd.options
        .filter((o) => !isBuiltinOption(o))
        .map((o) => describeOption(o));
    // 親コマンドの継承オプション
    if (opts?.includeInherited) {
        let parent = cmd.parent;
        while (parent) {
            for (const o of parent.options) {
                if (!isBuiltinOption(o)) {
                    options.push(describeOption(o, true));
                }
            }
            parent = parent.parent;
        }
    }
    // フルパス名を構築（親がある場合は "issues list" 形式、ルート直下は "init" のまま）
    const fullName = getCommandFullName(cmd) || cmd.name();
    const result = {
        name: fullName,
        description: cmd.description(),
        options,
    };
    // 引数
    const args = cmd.registeredArguments;
    if (args.length > 0) {
        result.arguments = args.map((arg) => ({
            name: arg.name(),
            description: arg.description,
            required: arg.required,
            variadic: arg.variadic,
        }));
    }
    // サブコマンド（help 除外）
    const subcommands = cmd.commands
        .filter((c) => c.name() !== "help")
        .map((c) => ({
        name: c.name(),
        description: c.description(),
    }));
    if (subcommands.length > 0) {
        result.subcommands = subcommands;
    }
    return result;
}
// =============================================================================
// describeProgram
// =============================================================================
/**
 * トップレベルプログラムのコマンド一覧を簡潔に記述する
 *
 * @param program - Commander.js のルート Command オブジェクト
 * @param version - CLI バージョン文字列
 * @returns プログラムのメタデータ（コマンド名・説明・サブコマンド名の一覧）
 */
export function describeProgram(program, version) {
    const commands = program.commands
        .filter((c) => c.name() !== "help")
        .map((c) => {
        const summary = {
            name: c.name(),
            description: c.description(),
        };
        const subs = c.commands
            .filter((s) => s.name() !== "help")
            .map((s) => s.name());
        if (subs.length > 0) {
            summary.subcommands = subs;
        }
        return summary;
    });
    return {
        name: program.name(),
        version,
        commands,
    };
}
//# sourceMappingURL=describe.js.map