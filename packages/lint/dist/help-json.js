const HELP_HINT = "Run '<command> --help' for AI-readable JSON, or '<command> --help-human' for verbose text.";
const HELP_FLAGS = new Set(['--help', '-h', '--help-human', '-H']);
function optionKey(o) {
    return o.long ?? o.short ?? '';
}
function shallowSubNode(c) {
    return { cmd: c.name(), desc: c.description(), args: [], opts: [], sub: null };
}
function visibleSubCommands(cmd) {
    return cmd.commands.filter((c) => !c.name().startsWith('help'));
}
export function commandPath(cmd) {
    const names = [];
    let c = cmd;
    while (c) {
        names.unshift(c.name());
        c = c.parent ?? null;
    }
    return names.join(' ');
}
export function commandToJson(cmd, opts = {}) {
    const args = cmd.registeredArguments.map((a) => ({
        name: a.name(),
        desc: a.description || undefined,
        required: a.required,
        variadic: a.variadic || undefined,
    }));
    const optsJson = cmd.options
        .filter((o) => !HELP_FLAGS.has(optionKey(o)))
        .map((o) => {
        const entry = { flag: o.flags, desc: o.description };
        if (o.required)
            entry.required = true;
        if (o.isBoolean())
            entry.bool = true;
        if (o.defaultValue !== undefined)
            entry.default = o.defaultValue;
        return entry;
    });
    const subs = visibleSubCommands(cmd);
    let sub = null;
    if (subs.length > 0) {
        sub = opts.deep ? subs.map((c) => commandToJson(c, { deep: true })) : subs.map(shallowSubNode);
    }
    return { cmd: commandPath(cmd), desc: cmd.description(), args, opts: optsJson, sub };
}
export function errorToJson(err, cmd) {
    const cmdPath = cmd ? commandPath(cmd) : undefined;
    const code = err.code;
    const base = {
        error: code ?? 'runtime_error',
        message: err.message,
        help_hint: HELP_HINT,
    };
    if (cmdPath)
        base.command = cmdPath;
    if (cmd) {
        if (code === 'commander.unknownCommand') {
            base.available_commands = visibleSubCommands(cmd).map((c) => c.name());
        }
        if (code === 'commander.unknownOption') {
            base.available_options = cmd.options.map(optionKey).filter(Boolean);
        }
        if (code === 'commander.missingArgument' ||
            code === 'commander.missingMandatoryOptionValue' ||
            code === 'commander.invalidArgument') {
            base.help_hint = `Run '${cmdPath} --help' for available arguments and options.`;
        }
    }
    return base;
}
export function emitJson(obj, opts = {}) {
    const json = opts.pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
    process.stdout.write(json + '\n');
    process.exit(opts.exitCode ?? 0);
}
/**
 * exitOverride() を有効化した Commander が「正常な制御フロー」のために投げる例外コード集。
 * これらは catch 側で「エラー」として JSON 化せず、保存された exitCode で素直に終了する。
 */
export const BENIGN_COMMANDER_CODES = new Set([
    'commander.helpDisplayed',
    'commander.help',
    'commander.version',
]);
export function isBenignCommanderError(err) {
    return BENIGN_COMMANDER_CODES.has(err.code);
}
/**
 * argv を 1 パスで scan し、--pretty / --help / --help-human / --version を抽出 + 対象コマンド解決。
 * Commander parse 前に呼び、unknown option エラーを回避するために返り値の remainingArgv を渡す。
 * value-taking option（--locale ja 等）を正しく消費するため program.options を参照する。
 */
export function preflightArgv(argv, root) {
    let pretty = false;
    let help = null;
    let version = false;
    const positional = [];
    const remaining = argv.slice(0, 2);
    // value-taking option のフラグセットを構築（--locale ja のような形式を正しく処理するため）
    const valueTakingFlags = new Set();
    for (const opt of root.options) {
        if (!opt.isBoolean()) {
            if (opt.long)
                valueTakingFlags.add(opt.long);
            if (opt.short)
                valueTakingFlags.add(opt.short);
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
        if (a === '--version' || a === '-V') {
            version = true;
            // Commander には渡さない（writeOut 抑制で空出力になるのを回避）
            continue;
        }
        // value-taking option は次のトークンをスキップ（positional 誤検出防止）
        if (valueTakingFlags.has(a)) {
            skipNext = true;
            remaining.push(a);
            continue;
        }
        if (!a.startsWith('-'))
            positional.push(a);
        remaining.push(a);
    }
    let target = root;
    for (const token of positional) {
        const next = target.commands.find((c) => c.name() === token || c.aliases().includes(token));
        if (!next)
            break;
        target = next;
    }
    return { pretty, help, version, target, remainingArgv: remaining };
}
export function walkCommands(root, fn) {
    fn(root);
    for (const sub of root.commands)
        walkCommands(sub, fn);
}
//# sourceMappingURL=help-json.js.map