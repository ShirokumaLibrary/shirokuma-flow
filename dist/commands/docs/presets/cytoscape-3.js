/**
 * cytoscape-3 プリセット
 *
 * Cytoscape.js 向け fetch プリセット。
 * cytoscape/cytoscape.js リポジトリの documentation/md/ 配下に
 * Markdown ドキュメントを配置しているソース専用。
 */
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fetchMarkdown, processImages, writeLastFetched, resolveGithubRepo, fetchGithubTreeEntries, buildGithubRawUrl, } from "./shared.js";
/**
 * cytoscape-3 プリセットのメタ情報。
 * `resolvePresetMeta("cytoscape-3")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://github.com/cytoscape/cytoscape.js",
    branch: "master",
    repoPath: "documentation/md",
    packageNames: ["cytoscape"],
};
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export async function execute(src, outDir, options, stats, logger) {
    const repoInfo = resolveGithubRepo(src, "cytoscape-3", logger);
    if (!repoInfo)
        return stats;
    const { owner, repo } = repoInfo;
    const branch = src.branch ?? "master";
    const repoPath = src.repoPath ?? "";
    logger.info(`[${src.name}] GitHub Tree API でファイル一覧を取得中: ${owner}/${repo}@${branch}`);
    let tree;
    try {
        tree = fetchGithubTreeEntries(owner, repo, branch);
    }
    catch (err) {
        logger.error(`[${src.name}] GitHub Tree API の取得に失敗: ${String(err)}`);
        return stats;
    }
    const mdFiles = tree.filter((item) => {
        if (item.type !== "blob")
            return false;
        if (!item.path.endsWith(".md"))
            return false;
        if (repoPath) {
            return item.path.startsWith(repoPath + "/") || item.path === repoPath;
        }
        return true;
    });
    logger.info(`[${src.name}] ${mdFiles.length} 件の Markdown ファイルを取得します。`);
    if (options.dryRun) {
        logger.info(`[${src.name}] Dry-run: 以下のファイルを取得予定:`);
        for (const file of mdFiles) {
            logger.info(`  ${buildGithubRawUrl(owner, repo, branch, file.path)}`);
        }
        return stats;
    }
    mkdirSync(outDir, { recursive: true });
    for (const file of mdFiles) {
        const relativePath = repoPath ? file.path.slice(repoPath.length + 1) : file.path;
        const outFile = join(outDir, relativePath);
        if (!options.force && existsSync(outFile)) {
            stats.skipped++;
            continue;
        }
        mkdirSync(dirname(outFile), { recursive: true });
        const rawUrl = buildGithubRawUrl(owner, repo, branch, file.path);
        const result = await fetchMarkdown(rawUrl, outFile, options.force ?? false);
        if (result === "downloaded") {
            stats.downloaded++;
        }
        else if (result === "skipped") {
            stats.skipped++;
        }
        else {
            logger.debug?.(`[${src.name}] FAILED: ${relativePath}`);
            stats.failed++;
        }
    }
    if (options.images !== false) {
        await processImages(outDir, options.force ?? false, stats, logger, src.name);
    }
    writeLastFetched(outDir);
    return stats;
}
//# sourceMappingURL=cytoscape-3.js.map