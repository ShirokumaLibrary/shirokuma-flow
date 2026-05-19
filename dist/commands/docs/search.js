/**
 * docs search subcommand - ローカルに取得したドキュメントの横断検索
 *
 * キーワードまたは正規表現でローカルファイルを検索し、
 * マッチ結果を table-json または json 形式で出力する。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../../utils/config.js";
import { discoverFilesystemSources, resolveOutputDir } from "./list.js";
// =============================================================================
// 検索ロジック
// =============================================================================
/**
 * ディレクトリ内の Markdown ファイルを再帰的に収集する。
 */
function collectMarkdownFiles(dir) {
    if (!existsSync(dir))
        return [];
    const results = [];
    function walk(current) {
        const entries = readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(current, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            }
            else if (entry.isFile() &&
                (entry.name.endsWith(".md") || entry.name.endsWith(".txt"))) {
                results.push(fullPath);
            }
        }
    }
    walk(dir);
    return results;
}
/**
 * ファイル内容を検索してマッチを返す。
 */
export function searchFile(filePath, pattern, contextLines) {
    let content;
    try {
        content = readFileSync(filePath, "utf-8");
    }
    catch {
        return [];
    }
    const lines = content.split("\n");
    const results = [];
    for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
            const ctx = [];
            if (contextLines > 0) {
                const start = Math.max(0, i - contextLines);
                const end = Math.min(lines.length - 1, i + contextLines);
                for (let j = start; j <= end; j++) {
                    ctx.push(`${j + 1}: ${lines[j]}`);
                }
            }
            results.push({ line: i + 1, text: lines[i], context: ctx });
        }
    }
    return results;
}
// =============================================================================
// セクション抽出ロジック
// =============================================================================
/**
 * ファイル内容から、指定行番号（1-based）を含む見出しセクションを抽出する。
 * 見出し行（`^#` で始まる行）を区切りとし、マッチ行が含まれるセクションの全文を返す。
 * セクションが見つからない場合はファイル全体を返す。
 */
export function extractSection(content, lineNumber) {
    const lines = content.split("\n");
    const targetIndex = lineNumber - 1; // 0-based
    // 見出し行のインデックスを収集
    const headingIndices = [];
    for (let i = 0; i < lines.length; i++) {
        if (/^#/.test(lines[i])) {
            headingIndices.push(i);
        }
    }
    // 見出しがない場合はファイル全体を返す
    if (headingIndices.length === 0) {
        return { content, startLine: 1 };
    }
    // targetIndex を含むセクションの開始・終了インデックスを特定
    let sectionStart = 0;
    let sectionEnd = lines.length;
    for (let i = 0; i < headingIndices.length; i++) {
        const headingIdx = headingIndices[i];
        const nextHeadingIdx = i + 1 < headingIndices.length ? headingIndices[i + 1] : lines.length;
        if (headingIdx <= targetIndex && targetIndex < nextHeadingIdx) {
            sectionStart = headingIdx;
            sectionEnd = nextHeadingIdx;
            break;
        }
    }
    // targetIndex が最初の見出しより前にある場合、ファイル先頭からそこまで
    if (targetIndex < headingIndices[0]) {
        sectionStart = 0;
        sectionEnd = headingIndices[0];
    }
    return {
        content: lines.slice(sectionStart, sectionEnd).join("\n"),
        startLine: sectionStart + 1, // 1-based
    };
}
// =============================================================================
// Handler
// =============================================================================
export async function cmdSearch(options, logger) {
    const projectPath = options.project ?? process.cwd();
    const config = loadConfig(projectPath, "shirokuma-docs.config.yaml");
    const allSources = discoverFilesystemSources(projectPath, config.docs?.outputDir);
    if (allSources.length === 0) {
        logger.error("取得済みのドキュメントがありません。\n" +
            "`docs fetch <name>` で取得するか、`.shirokuma/docs/` に fetch 済みドキュメントを配置してください。");
        return 1;
    }
    // 対象ソースを絞り込む
    let targets = allSources;
    if (options.source) {
        targets = allSources.filter((s) => s.name === options.source);
        if (targets.length === 0) {
            logger.error(`ソース "${options.source}" が見つかりません。\n` +
                `取得済み: ${allSources.map((s) => s.name).join(", ")}`);
            return 1;
        }
    }
    // 検索パターン構築
    let pattern;
    try {
        if (options.regex) {
            pattern = new RegExp(options.query, "i");
        }
        else {
            // キーワード検索: 特殊文字をエスケープ
            const escaped = options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            pattern = new RegExp(escaped, "i");
        }
    }
    catch (err) {
        logger.error(`無効な正規表現です: ${options.query}\n${String(err)}`);
        return 1;
    }
    const contextLines = options.context ?? 0;
    const limitCount = options.limit;
    const sectionMode = options.section ?? false;
    const allMatches = [];
    // --section モードでは重複セクションを除くためのキーを管理
    const seenSectionKeys = new Set();
    outer: for (const src of targets) {
        const outDir = resolveOutputDir(projectPath, src.name, src.outputDir, config.docs?.outputDir);
        if (!existsSync(outDir)) {
            logger.info(`[${src.name}] ローカルファイルが見つかりません。fetch を先に実行してください。`);
            continue;
        }
        const files = collectMarkdownFiles(outDir);
        for (const filePath of files) {
            let fileContent;
            const matches = searchFile(filePath, pattern, contextLines);
            for (const m of matches) {
                const matchEntry = {
                    source: src.name,
                    file: filePath,
                    line: m.line,
                    text: m.text,
                    context: m.context,
                };
                if (sectionMode) {
                    // ファイル内容をキャッシュ（同一ファイルで複数マッチがある場合の効率化）
                    if (fileContent === undefined) {
                        try {
                            fileContent = readFileSync(filePath, "utf-8");
                        }
                        catch {
                            fileContent = "";
                        }
                    }
                    const section = extractSection(fileContent, m.line);
                    // 同一ファイルの同一セクションは1件のみ収録（重複排除）
                    const sectionKey = `${filePath}::${section.startLine}`;
                    if (seenSectionKeys.has(sectionKey))
                        continue;
                    seenSectionKeys.add(sectionKey);
                    matchEntry.sectionContent = section.content;
                }
                allMatches.push(matchEntry);
                // --limit に達したら全ループを終了
                if (limitCount !== undefined && allMatches.length >= limitCount) {
                    break outer;
                }
            }
        }
    }
    if (allMatches.length === 0) {
        logger.info(`"${options.query}" に一致する結果が見つかりませんでした。`);
        return 0;
    }
    if (options.format === "json") {
        process.stdout.write(JSON.stringify(allMatches, null, 2) + "\n");
        return 0;
    }
    // table-json 形式（デフォルト）
    const tableData = allMatches.map((m) => ({
        Source: m.source,
        File: m.file,
        Line: m.line,
        Text: m.text.trim().slice(0, 120),
        ...(contextLines > 0 ? { Context: (m.context ?? []).join("\n") } : {}),
        ...(sectionMode && m.sectionContent !== undefined
            ? { Section: m.sectionContent }
            : {}),
    }));
    process.stdout.write(JSON.stringify(tableData, null, 2) + "\n");
    return 0;
}
//# sourceMappingURL=search.js.map