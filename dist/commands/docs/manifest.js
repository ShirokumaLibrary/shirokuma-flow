/**
 * docs manifest - MANIFEST.md の生成・更新・エントリ削除
 *
 * `docs fetch` 完了後に `.shirokuma/docs/MANIFEST.md` を自動生成し、
 * Claude Code が docs の存在を自然に認識できるようにする。
 * `docs remove` 時は該当エントリを manifest から削除する。
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, } from "node:fs";
import { join, resolve } from "node:path";
import { resolveOutputDir, countMarkdownFiles } from "./list.js";
// =============================================================================
// Helpers
// =============================================================================
/** docsRoot ディレクトリを解決する */
function resolveDocsRoot(projectPath, docsOutputDir) {
    return docsOutputDir
        ? resolve(projectPath, docsOutputDir)
        : resolve(projectPath, ".shirokuma/docs");
}
/** .last-fetched ファイルから日付文字列（YYYY-MM-DD）を取得する */
function readLastFetchedDate(outDir) {
    const lastFetchedFile = join(outDir, ".last-fetched");
    if (!existsSync(lastFetchedFile))
        return null;
    try {
        const iso = readFileSync(lastFetchedFile, "utf-8").trim();
        const date = new Date(iso);
        if (isNaN(date.getTime()))
            return null;
        return date.toISOString().slice(0, 10);
    }
    catch {
        return null;
    }
}
/** MANIFEST.md のテーブル行をパースして ManifestEntry 配列を返す */
export function parseManifest(content) {
    const entries = [];
    const lines = content.split("\n");
    for (const line of lines) {
        // テーブル行: | source | package | date | count |
        const match = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(\d+)\s*\|$/);
        if (!match)
            continue;
        const source = match[1].trim();
        const pkg = match[2].trim();
        // ヘッダー行・セパレータ行をスキップ
        if (source === "ソース" || source.startsWith("-"))
            continue;
        entries.push({
            source,
            package: pkg,
            lastFetched: match[3],
            fileCount: parseInt(match[4], 10),
        });
    }
    return entries;
}
/** ManifestEntry 配列から MANIFEST.md の内容を生成する */
export function formatManifest(entries) {
    const lines = [
        "# Docs Manifest",
        "",
        "fetch 済みのドキュメントソース。`shirokuma-docs docs search \"<keyword>\" --source <name> --section --limit 5` で検索可能。",
        "",
    ];
    if (entries.length === 0) {
        lines.push("(ソースなし)");
        lines.push("");
        return lines.join("\n");
    }
    lines.push("| ソース | パッケージ | Last Fetched | ファイル数 |");
    lines.push("|-------|----------|-------------|---------|");
    // ソース名でソート
    const sorted = [...entries].sort((a, b) => a.source.localeCompare(b.source));
    for (const entry of sorted) {
        lines.push(`| ${entry.source} | ${entry.package} | ${entry.lastFetched} | ${entry.fileCount} |`);
    }
    lines.push("");
    return lines.join("\n");
}
// =============================================================================
// Public API
// =============================================================================
/**
 * MANIFEST.md を生成/更新する。
 * fetch 済みの全ソースから manifest エントリを構築し、既存の manifest とマージする。
 *
 * @param projectPath - プロジェクトルートパス
 * @param sources - ソース一覧（name と outputDir のみ使用）
 * @param docsOutputDir - config の docs.outputDir（デフォルト: ".shirokuma/docs"）
 * @param resolvePackageName - ソース名からパッケージ名を解決するコールバック（省略時はソース名をそのまま使用）
 */
export async function writeManifest(projectPath, sources, docsOutputDir, resolvePackageName) {
    const docsRoot = resolveDocsRoot(projectPath, docsOutputDir);
    const manifestPath = join(docsRoot, "MANIFEST.md");
    // 既存の manifest をパース（マージ用）
    let existingEntries = [];
    if (existsSync(manifestPath)) {
        try {
            const content = readFileSync(manifestPath, "utf-8");
            existingEntries = parseManifest(content);
        }
        catch {
            // パース失敗時は空配列で上書き
        }
    }
    // 各ソースの manifest エントリを構築
    const newEntries = [];
    for (const src of sources) {
        const outDir = resolveOutputDir(projectPath, src.name, src.outputDir, docsOutputDir);
        const lastFetched = readLastFetchedDate(outDir);
        if (!lastFetched)
            continue; // 未 fetch のソースはスキップ
        const fileCount = countMarkdownFiles(outDir);
        // パッケージ名: コールバックで解決（未指定時はソース名をそのまま使う）
        let packageName = src.name;
        if (resolvePackageName) {
            try {
                const resolved = await resolvePackageName(src.name);
                if (resolved)
                    packageName = resolved;
            }
            catch {
                // 解決失敗時はソース名をそのまま使う
            }
        }
        newEntries.push({
            source: src.name,
            package: packageName,
            lastFetched,
            fileCount,
        });
    }
    // 既存エントリとマージ: config に登録されていないが既存 manifest にあるエントリも保持
    // （手動削除されるまで維持する）
    const newSourceNames = new Set(newEntries.map((e) => e.source));
    const mergedEntries = [
        ...newEntries,
        ...existingEntries.filter((e) => !newSourceNames.has(e.source)),
    ];
    mkdirSync(docsRoot, { recursive: true });
    writeFileSync(manifestPath, formatManifest(mergedEntries), "utf-8");
}
/**
 * MANIFEST.md から指定ソースのエントリを削除する。
 *
 * @param projectPath - プロジェクトルートパス
 * @param sourceName - 削除するソース名
 * @param docsOutputDir - config の docs.outputDir（デフォルト: ".shirokuma/docs"）
 */
export function removeManifestEntry(projectPath, sourceName, docsOutputDir) {
    const docsRoot = resolveDocsRoot(projectPath, docsOutputDir);
    const manifestPath = join(docsRoot, "MANIFEST.md");
    if (!existsSync(manifestPath))
        return;
    let entries;
    try {
        const content = readFileSync(manifestPath, "utf-8");
        entries = parseManifest(content);
    }
    catch {
        return;
    }
    const filtered = entries.filter((e) => e.source !== sourceName);
    // エントリ数が変わらない場合は書き込み不要
    if (filtered.length === entries.length)
        return;
    writeFileSync(manifestPath, formatManifest(filtered), "utf-8");
}
//# sourceMappingURL=manifest.js.map