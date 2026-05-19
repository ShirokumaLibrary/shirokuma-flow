import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fetchMarkdown, writeLastFetched } from './fetch-markdown.js';
import { buildGithubRawUrl, fetchGithubSubtreeBySha, fetchGithubTreeEntries, parseGithubRepoUrl, resolveGithubTreeSha, } from './github.js';
import { NOOP_LOGGER } from './logger.js';
/**
 * GitHub Tree API でファイル一覧を取得し、各ファイルを raw URL から保存する shared helper。
 *
 * 各 preset ファイル（laravel-11 / coreui-* / remix-2 ...）から呼び出す薄い共通層で、
 * preset 側は filter（除外ファイル / 言語ディレクトリ）や post-processing を各自で担う。
 * 画像処理は行わない — preset 側が `processImages` を後段で呼ぶ。
 *
 * `useSubtreeSha=true` は ENOBUFS 回避のため `repoPath` を段階的に Tree API で辿って
 * subtree SHA に解決してから recursive 取得する（巨大リポジトリ用）。
 */
export async function fetchGithubTree(params) {
    const { src, outDir, options, stats, fileExtensions = ['.md'], excludeFiles: excludeFileList = [], excludePathPattern, useSubtreeSha = false, defaultBranch, defaultRepoPath, presetName, } = params;
    const logger = params.logger ?? NOOP_LOGGER;
    if (!src.url) {
        logger.error(`[${src.name}] ${presetName} プリセットには url が必要です。`);
        return stats;
    }
    const repoInfo = parseGithubRepoUrl(src.url);
    if (!repoInfo) {
        logger.error(`[${src.name}] ${presetName} プリセットには url を "https://github.com/{owner}/{repo}" 形式で指定してください。`);
        return stats;
    }
    const { owner, repo } = repoInfo;
    const branch = src.branch ?? defaultBranch;
    const repoPaths = normalizeRepoPath(src.repoPath ?? defaultRepoPath);
    const excludeFiles = new Set(excludeFileList);
    logger.info(`[${src.name}] GitHub Tree API でファイル一覧を取得中: ${owner}/${repo}@${branch}`);
    const tree = await fetchTree({
        owner,
        repo,
        branch,
        repoPaths,
        useSubtreeSha,
        sourceName: src.name,
        logger,
    });
    if (!tree)
        return stats;
    const files = tree.filter((entry) => isTargetFile(entry, repoPaths, fileExtensions, excludeFiles, excludePathPattern));
    logger.info(`[${src.name}] ${files.length} 件のファイルを取得します。`);
    if (options.dryRun) {
        logger.info(`[${src.name}] Dry-run: 以下のファイルを取得予定:`);
        for (const file of files) {
            logger.info(`  ${buildGithubRawUrl(owner, repo, branch, file.path)}`);
        }
        return stats;
    }
    mkdirSync(outDir, { recursive: true });
    for (const file of files) {
        const relativePath = stripLeadingRepoPath(file.path, repoPaths);
        const outFile = join(outDir, relativePath);
        if (!options.force && existsSync(outFile)) {
            stats.skipped++;
            continue;
        }
        mkdirSync(dirname(outFile), { recursive: true });
        const rawUrl = buildGithubRawUrl(owner, repo, branch, file.path);
        const result = await fetchMarkdown(rawUrl, outFile, options.force ?? false, logger);
        if (result === 'downloaded') {
            stats.downloaded++;
        }
        else if (result === 'skipped') {
            stats.skipped++;
        }
        else {
            logger.debug?.(`[${src.name}] FAILED: ${relativePath}`);
            stats.failed++;
        }
    }
    writeLastFetched(outDir);
    return stats;
}
function normalizeRepoPath(repoPath) {
    if (!repoPath)
        return [];
    return Array.isArray(repoPath) ? repoPath : [repoPath];
}
async function fetchTree(args) {
    const { owner, repo, branch, repoPaths, useSubtreeSha, sourceName, logger } = args;
    try {
        if (!useSubtreeSha || repoPaths.length !== 1 || !repoPaths[0]) {
            return await fetchGithubTreeEntries(owner, repo, branch);
        }
        const subtreePath = repoPaths[0];
        const sha = await resolveSubtreeSha(owner, repo, branch, subtreePath, logger, sourceName);
        if (!sha)
            return null;
        const tree = await fetchGithubSubtreeBySha(owner, repo, sha);
        return tree.map((e) => ({ path: `${subtreePath}/${e.path}`, type: e.type }));
    }
    catch (err) {
        logger.error(`[${sourceName}] GitHub Tree API の取得に失敗: ${String(err)}`);
        return null;
    }
}
async function resolveSubtreeSha(owner, repo, branch, repoPath, logger, sourceName) {
    let currentRef = branch;
    for (const segment of repoPath.split('/').filter(Boolean)) {
        logger.info(`[${sourceName}] サブツリー SHA を解決中: ${currentRef} → ${segment}`);
        const sha = await resolveGithubTreeSha(owner, repo, currentRef, segment);
        if (!sha) {
            logger.error(`[${sourceName}] サブツリー "${segment}" が見つかりません。(ref: ${currentRef})`);
            return null;
        }
        currentRef = sha;
    }
    return currentRef;
}
function isTargetFile(entry, repoPaths, extensions, excludeFiles, excludePathPattern) {
    if (entry.type !== 'blob')
        return false;
    const filename = entry.path.split('/').pop() ?? '';
    if (excludeFiles.has(filename))
        return false;
    if (excludePathPattern && excludePathPattern.test(entry.path))
        return false;
    if (!extensions.some((ext) => entry.path.endsWith(ext)))
        return false;
    if (repoPaths.length === 0)
        return true;
    return repoPaths.some((root) => entry.path === root || entry.path.startsWith(`${root}/`));
}
function stripLeadingRepoPath(filePath, repoPaths) {
    for (const root of repoPaths) {
        if (filePath === root)
            return filePath.split('/').pop() ?? filePath;
        const prefix = `${root}/`;
        if (filePath.startsWith(prefix))
            return filePath.slice(prefix.length);
    }
    return filePath;
}
//# sourceMappingURL=fetch-github-tree.js.map