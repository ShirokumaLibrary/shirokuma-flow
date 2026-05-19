/**
 * rules inject command
 *
 * .shirokuma/rules/ 配下のルールをフロントマターで
 * フィルタリングして stdout に出力する。
 *
 * フォールバック: .shirokuma/rules/ が存在しない場合、
 * バンドルプラグインの rules/ から直接読み込む。
 */
import { join, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { parseFrontmatter } from "../../validators/frontmatter.js";
import { listFiles } from "../../utils/file.js";
import { getLanguageSetting, getBundledPluginPath, getBundledPluginPathJa } from "../../utils/skills-repo.js";
/**
 * ディレクトリからルールエントリを読み込む
 *
 * @param rulesDir - ルールディレクトリの絶対パス
 * @param stripFrontmatter - true: 常にフロントマターを除去、false: フロントマターがないファイルは raw を保持
 * @returns ルールエントリ配列
 */
function loadRules(rulesDir, stripFrontmatter) {
    const filePaths = listFiles(rulesDir, { extensions: [".md"], recursive: true });
    const entries = [];
    const basePath = resolve(rulesDir) + "/";
    for (const filePath of filePaths) {
        try {
            const raw = readFileSync(filePath, "utf-8");
            const parsed = parseFrontmatter(raw);
            entries.push({
                filePath,
                relativePath: filePath.startsWith(basePath) ? filePath.slice(basePath.length) : filePath,
                content: stripFrontmatter || parsed.hasFrontmatter ? parsed.content : raw,
                frontmatterData: parsed.data,
                hasFrontmatter: parsed.hasFrontmatter,
            });
        }
        catch {
            // 読み取りエラーはスキップ
        }
    }
    return entries;
}
/**
 * スコープ配列にターゲットスコープが含まれるか判定する
 *
 * `scope: default` は予約スコープで、どの --scope が指定されても常にマッチする。
 * これにより旧 `.claude/rules/` の paths なしルール（常に読み込まれる）と同等の挙動を実現する。
 *
 * @param scopeField - フロントマターの scope フィールド値
 * @param targetScope - フィルタリング対象スコープ
 * @returns マッチすれば true
 */
function matchesScope(scopeField, targetScope) {
    if (Array.isArray(scopeField)) {
        return scopeField.includes(targetScope) || scopeField.includes("default");
    }
    if (typeof scopeField === "string") {
        return scopeField === targetScope || scopeField === "default";
    }
    return false;
}
/**
 * rules inject コマンド実装
 */
export async function rulesInjectCommand(options) {
    const { scope, category, priority, project } = options;
    // .shirokuma/rules/ ディレクトリを確認（言語サブディレクトリなし）
    const shirokumaRulesDir = join(project, ".shirokuma", "rules");
    let entries;
    if (existsSync(shirokumaRulesDir)) {
        entries = loadRules(shirokumaRulesDir, true);
    }
    else {
        // フォールバック: バンドルプラグインから読み込む（言語選択はここでのみ使用）
        const langOpt = options.lang?.toLowerCase();
        const langDir = (langOpt === "ja" || langOpt === "en")
            ? langOpt
            : getLanguageSetting(project) === "japanese" ? "ja" : "en";
        const bundledPluginPath = langDir === "ja" ? getBundledPluginPathJa() : getBundledPluginPath();
        entries = loadRules(join(bundledPluginPath, "rules"), false);
    }
    // フィルタリング
    const filtered = entries.filter((entry) => {
        // フロントマターなしのエントリはスコープフィルタをスキップして全出力
        if (!entry.hasFrontmatter || !entry.frontmatterData) {
            return true;
        }
        const data = entry.frontmatterData;
        // scope フィルタ
        if (!matchesScope(data["scope"], scope)) {
            return false;
        }
        // category フィルタ (指定された場合のみ)
        if (category !== undefined) {
            if (typeof data["category"] !== "string" || data["category"] !== category) {
                return false;
            }
        }
        // priority フィルタ (指定された場合のみ)
        if (priority !== undefined) {
            if (typeof data["priority"] !== "string" || data["priority"] !== priority) {
                return false;
            }
        }
        return true;
    });
    if (filtered.length === 0) {
        return;
    }
    // 本文を XML タグで囲んで結合して出力
    let output = filtered
        .map((entry) => `<rule-file file="${entry.relativePath}">\n${entry.content.trim()}\n</rule-file file="${entry.relativePath}">`)
        .join("\n");
    // max-tokens による文字数制限 (概算: 1 トークン ≈ 4 文字、英語テキスト基準。日本語では 1 文字 ≈ 2-3 トークンのため過大評価となるが、安全側に倒れる)
    if (options.maxTokens !== undefined && options.maxTokens > 0) {
        const maxChars = options.maxTokens * 4;
        if (output.length > maxChars) {
            output = output.slice(0, maxChars);
        }
    }
    process.stdout.write(output + "\n");
}
//# sourceMappingURL=inject.js.map