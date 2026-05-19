/**
 * docs list subcommand - 取得済みソース一覧と最終取得日時の表示
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig } from "../../utils/config.js";
// =============================================================================
// Helper: 出力ディレクトリを解決
// =============================================================================
export function resolveOutputDir(projectPath, sourceName, configOutputDir, docsOutputDir) {
    if (configOutputDir) {
        return resolve(projectPath, configOutputDir);
    }
    const base = docsOutputDir
        ? resolve(projectPath, docsOutputDir)
        : resolve(projectPath, ".shirokuma/docs");
    return join(base, sourceName);
}
// =============================================================================
// Helper: config 未登録時のファイルシステムフォールバック
// =============================================================================
export function discoverFilesystemSources(projectPath, docsOutputDir) {
    const docsBaseDir = docsOutputDir
        ? resolve(projectPath, docsOutputDir)
        : resolve(projectPath, ".shirokuma/docs");
    if (!existsSync(docsBaseDir))
        return [];
    const entries = readdirSync(docsBaseDir, { withFileTypes: true });
    return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => ({ name: e.name, url: "(filesystem)" }));
}
// =============================================================================
// Helper: ファイル数をカウント
// =============================================================================
export function countMarkdownFiles(dir) {
    if (!existsSync(dir))
        return 0;
    try {
        let count = 0;
        const entries = readdirSync(dir);
        for (const entry of entries) {
            if (entry.startsWith("."))
                continue;
            const fullPath = join(dir, entry);
            try {
                const st = statSync(fullPath);
                if (st.isDirectory()) {
                    count += countMarkdownFiles(fullPath);
                }
                else if (entry.endsWith(".md") || entry.endsWith(".adoc")) {
                    count++;
                }
            }
            catch {
                // アクセスできないエントリはスキップ
            }
        }
        return count;
    }
    catch {
        return 0;
    }
}
// =============================================================================
// Handler
// =============================================================================
export async function cmdList(options, logger) {
    const projectPath = options.project ?? process.cwd();
    const config = loadConfig(projectPath, "shirokuma-docs.config.yaml");
    const sources = discoverFilesystemSources(projectPath, config.docs?.outputDir);
    if (sources.length === 0) {
        logger.info("取得済みのドキュメントがありません。\n" +
            "取得するには: shirokuma-docs docs fetch <name>");
        return 0;
    }
    const statuses = sources.map((src) => {
        const outDir = resolveOutputDir(projectPath, src.name, src.outputDir, config.docs?.outputDir);
        const lastFetchedFile = join(outDir, ".last-fetched");
        let lastFetched = null;
        if (existsSync(lastFetchedFile)) {
            try {
                lastFetched = readFileSync(lastFetchedFile, "utf-8").trim();
            }
            catch {
                lastFetched = null;
            }
        }
        const fileCount = countMarkdownFiles(outDir);
        return {
            name: src.name,
            url: src.url,
            outputDir: outDir,
            linkFormat: src.linkFormat ?? "md",
            fetchStrategy: src.fetchStrategy ?? "individual",
            lastFetched,
            fileCount,
        };
    });
    if (options.format === "json") {
        process.stdout.write(JSON.stringify(statuses, null, 2) + "\n");
        return 0;
    }
    // table-json 形式（デフォルト）
    const tableData = statuses.map((s) => ({
        Name: s.name,
        URL: s.url,
        "Last Fetched": s.lastFetched ?? "(未取得)",
        Files: s.fileCount,
        Strategy: s.fetchStrategy,
        "Link Format": s.linkFormat,
    }));
    process.stdout.write(JSON.stringify(tableData, null, 2) + "\n");
    return 0;
}
//# sourceMappingURL=list.js.map