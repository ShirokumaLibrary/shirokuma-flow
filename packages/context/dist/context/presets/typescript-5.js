/**
 * typescript-5 プリセット。サイト固有の微調整が必要になればここに追記する。
 *
 * microsoft/TypeScript-Website モノレポ（default branch `v2`）の 3 パッケージ
 * (documentation / tsconfig-reference / glossary) から英語 Markdown を統合取得し、
 * 出力先をパッケージごとに分離する（`fetchGithubTree` の flatten 挙動と合わないため
 * 直接 github primitives を使う）。
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildGithubRawUrl, fetchGithubTreeEntries, parseGithubRepoUrl } from '../github.js';
import { fetchMarkdown, writeLastFetched } from '../fetch-markdown.js';
import { PRESETS } from '../presets.js';
import { processImages } from '../process-images.js';
const meta = PRESETS['typescript-5'];
const DOC_PACKAGES = [
    { prefix: 'packages/documentation/copy/en/', outSubdir: 'documentation' },
    { prefix: 'packages/tsconfig-reference/copy/en/', outSubdir: 'tsconfig-reference' },
    { prefix: 'packages/glossary/copy/en/', outSubdir: 'glossary' },
];
export async function execute(params) {
    const { src, outDir, options, stats, logger } = params;
    const repoUrl = src.url ?? meta.url;
    const repoInfo = parseGithubRepoUrl(repoUrl);
    if (!repoInfo) {
        logger.error(`[${src.name}] typescript-5 プリセットには url を "https://github.com/{owner}/{repo}" 形式で指定してください。`);
        return stats;
    }
    const { owner, repo } = repoInfo;
    const branch = src.branch ?? meta.branch ?? 'v2';
    logger.info(`[${src.name}] GitHub Tree API でファイル一覧を取得中: ${owner}/${repo}@${branch}`);
    let tree;
    try {
        tree = await fetchGithubTreeEntries(owner, repo, branch);
    }
    catch (err) {
        logger.error(`[${src.name}] GitHub Tree API の取得に失敗: ${String(err)}`);
        return stats;
    }
    const filesToFetch = [];
    for (const pkg of DOC_PACKAGES) {
        const pkgFiles = tree.filter((item) => item.type === 'blob' && item.path.endsWith('.md') && item.path.startsWith(pkg.prefix));
        for (const file of pkgFiles) {
            filesToFetch.push({
                path: file.path,
                outSubdir: pkg.outSubdir,
                relativePath: file.path.slice(pkg.prefix.length),
            });
        }
        logger.info(`[${src.name}]   ${pkg.outSubdir}: ${pkgFiles.length} 件`);
    }
    logger.info(`[${src.name}] 合計 ${filesToFetch.length} 件の Markdown ファイルを取得します。`);
    if (options.dryRun) {
        logger.info(`[${src.name}] Dry-run: 以下のファイルを取得予定:`);
        for (const file of filesToFetch) {
            logger.info(`  [${file.outSubdir}] ${buildGithubRawUrl(owner, repo, branch, file.path)}`);
        }
        return stats;
    }
    mkdirSync(outDir, { recursive: true });
    for (const file of filesToFetch) {
        const outFile = join(outDir, file.outSubdir, file.relativePath);
        // raw.githubusercontent.com は Last-Modified を返さないため、fetchMarkdown の
        // HEAD 判定が機能しない。existsSync で早期 skip する（同 preset では原版も同じ扱い）。
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
            logger.debug?.(`[${src.name}] FAILED: ${file.outSubdir}/${file.relativePath}`);
            stats.failed++;
        }
    }
    if (options.images !== false) {
        await processImages({
            outDir,
            force: options.force ?? false,
            stats,
            logger,
            sourceName: src.name,
        });
    }
    writeLastFetched(outDir);
    return stats;
}
//# sourceMappingURL=typescript-5.js.map