/**
 * hooks evaluate - Evaluate destructive command rules
 *
 * stdin から PreToolUse JSON を読み取り、破壊的コマンドを評価する。
 * - 拒否時: Claude Code hook 出力形式の JSON を stdout に出力し exit 0
 * - 許可時: 何も出力せず exit 0
 * - エラー時: fail-open（全許可）
 */
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { getBundledPluginPathFor, getGlobalCachePath, PLUGIN_NAME_HOOKS, } from "../../utils/skills-repo.js";
import { loadConfig } from "../../utils/config.js";
import { safeRegExp } from "../../utils/sanitize.js";
import { readStdin } from "./helpers.js";
// ========================================
// Core Functions
// ========================================
/**
 * blocked-commands.json からルールを読み込む
 *
 * バンドルプラグイン → グローバルキャッシュの2段階フォールバック。
 * 見つからない場合は空配列を返す（fail-open）。
 */
export function loadBlockedCommands() {
    const paths = [
        join(getBundledPluginPathFor(PLUGIN_NAME_HOOKS), "hooks", "blocked-commands.json"),
    ];
    const cachePath = getGlobalCachePath(PLUGIN_NAME_HOOKS);
    if (cachePath) {
        paths.push(join(cachePath, "hooks", "blocked-commands.json"));
    }
    for (const p of paths) {
        if (!existsSync(p))
            continue;
        try {
            const content = readFileSync(p, "utf-8");
            const config = JSON.parse(content);
            return config.rules;
        }
        catch {
            continue;
        }
    }
    return [];
}
/**
 * hooks.allow に基づきアクティブルールをフィルタする
 */
export function filterActiveRules(rules, allowIds) {
    if (allowIds === undefined || allowIds.length === 0) {
        return rules.filter(r => r.enabled);
    }
    const allowSet = new Set(allowIds);
    return rules.filter(r => r.enabled && !allowSet.has(r.id));
}
/**
 * コマンドから heredoc ブロックを除去する
 *
 * <<'DELIMITER'..DELIMITER, <<"DELIMITER"..DELIMITER, <<DELIMITER..DELIMITER,
 * <<-DELIMITER..DELIMITER 形式のコンテンツをプレースホルダーに置き換える。
 */
export function stripHeredocs(command) {
    // heredoc 開始行を検出するパターン: <<[-]['"]?DELIM['"]?
    const heredocStartPattern = /<<-?(?:'([^'\n]+)'|"([^"\n]+)"|([A-Za-z_][A-Za-z0-9_]*))/;
    const lines = command.split("\n");
    const result = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const match = heredocStartPattern.exec(line);
        if (match) {
            // デリミタを取り出す（クォート付き / なし の各グループ）
            const delim = match[1] ?? match[2] ?? match[3];
            if (delim) {
                // 開始行をプレースホルダーに置き換えて追加
                result.push(line.slice(0, match.index) + `<<HEREDOC `);
                i++;
                // 終端デリミタが現れるまでの行をスキップ
                while (i < lines.length) {
                    const content = lines[i].trim();
                    if (content === delim) {
                        i++; // 終端デリミタ行もスキップ
                        break;
                    }
                    i++;
                }
                continue;
            }
        }
        result.push(line);
        i++;
    }
    return result.join("\n");
}
/**
 * コマンドから Markdown コードブロックを除去する
 *
 * ``` または ``` lang で囲まれたブロックのコンテンツをプレースホルダーに置き換える。
 */
export function stripCodeBlocks(command) {
    return command.replace(/```[^\n]*\n[\s\S]*?```/g, "```CODEBLOCK```");
}
/**
 * コマンドからクォート文字列を除去する
 *
 * 処理順序:
 * 1. heredoc ブロック除去（複数行コンテンツ）
 * 2. Markdown コードブロック除去
 * 3. 改行をスペースに変換（残った改行を正規化）
 * 4. シングル/ダブルクォート内テキスト除去
 */
export function stripQuotedStrings(command) {
    return stripCodeBlocks(stripHeredocs(command))
        .replace(/\n/g, " ")
        .replace(/'[^']*'/g, "")
        .replace(/"[^"]*"/g, "");
}
/**
 * コマンドをアクティブルールのパターンでマッチングする
 *
 * @returns マッチしたルール、またはマッチなしの場合 null
 */
export function evaluateCommand(command, activeRules) {
    const stripped = stripQuotedStrings(command);
    for (const rule of activeRules) {
        const regex = safeRegExp(rule.pattern);
        if (!regex)
            continue;
        if (regex.test(stripped)) {
            return rule;
        }
    }
    return null;
}
// ========================================
// Command Handler
// ========================================
/**
 * `hooks evaluate` コマンドのメインハンドラ
 */
export async function hooksEvaluateCommand(configPath) {
    try {
        const input = await readStdin();
        if (!input || input.trim() === "") {
            return;
        }
        let parsed;
        try {
            parsed = JSON.parse(input);
        }
        catch {
            return;
        }
        const command = parsed.tool_input?.command;
        if (!command) {
            return;
        }
        const allRules = loadBlockedCommands();
        if (allRules.length === 0) {
            return;
        }
        let allowIds;
        try {
            const config = loadConfig(process.cwd(), configPath ?? "shirokuma-docs.config.yaml");
            allowIds = config.hooks?.allow;
        }
        catch {
            allowIds = undefined;
        }
        const activeRules = filterActiveRules(allRules, allowIds);
        if (activeRules.length === 0) {
            return;
        }
        const matchedRule = evaluateCommand(command, activeRules);
        if (matchedRule) {
            const output = {
                hookSpecificOutput: {
                    hookEventName: "PreToolUse",
                    permissionDecision: "deny",
                    permissionDecisionReason: matchedRule.reason,
                },
            };
            process.stdout.write(JSON.stringify(output));
        }
    }
    catch {
        // fail-open
    }
}
//# sourceMappingURL=evaluate.js.map