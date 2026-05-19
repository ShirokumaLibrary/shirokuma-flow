/**
 * commander-14 プリセット
 *
 * Commander.js 向け fetch プリセット。
 * tj/commander.js リポジトリの docs/ と examples/ 配下に
 * Markdown ドキュメントを配置しているソース専用。
 *
 * docs/zh-CN/ に中国語の翻訳ファイルがあるため、
 * 英語版のみを取得するようフィルタする。
 */
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fetchMarkdown, processImages, writeLastFetched, resolveGithubRepo, fetchGithubTreeEntries, buildGithubRawUrl, } from "./shared.js";
/**
 * commander-14 プリセットのメタ情報。
 * `resolvePresetMeta("commander-14")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://github.com/tj/commander.js",
    branch: "master",
    repoPath: ["docs", "examples"],
    packageNames: ["commander"],
};
/** 非英語の翻訳ディレクトリを除外するパターン */
const EXCLUDE_LANG_DIR = /\/zh-CN\//;
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export async function execute(src, outDir, options, stats, logger) {
    const repoInfo = resolveGithubRepo(src, "commander-14", logger);
    if (!repoInfo)
        return stats;
    const { owner, repo } = repoInfo;
    const branch = src.branch ?? "master";
    const rawRepoPath = src.repoPath ?? "";
    const repoPaths = Array.isArray(rawRepoPath)
        ? rawRepoPath
        : rawRepoPath
            ? [rawRepoPath]
            : [];
    logger.info(`[${src.name}] GitHub Tree API でファイル一覧を取得中: ${owner}/${repo}@${branch}`);
    let tree;
    try {
        tree = fetchGithubTreeEntries(owner, repo, branch);
    }
    catch (err) {
        logger.error(`[${src.name}] GitHub Tree API の取得に失敗: ${String(err)}`);
        return stats;
    }
    const matchesRepoPath = (filePath) => repoPaths.find((rp) => filePath.startsWith(rp + "/") || filePath === rp);
    const mdFiles = tree.filter((item) => {
        if (item.type !== "blob")
            return false;
        if (!item.path.endsWith(".md"))
            return false;
        if (EXCLUDE_LANG_DIR.test(item.path))
            return false;
        if (repoPaths.length === 0)
            return true;
        return matchesRepoPath(item.path) !== undefined;
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
        const matchedRepoPath = matchesRepoPath(file.path) ?? "";
        const relativePath = matchedRepoPath
            ? file.path.slice(matchedRepoPath.length + 1)
            : file.path;
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
//# sourceMappingURL=commander-14.js.map