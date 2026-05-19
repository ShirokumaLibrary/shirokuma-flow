/**
 * typescript-5 プリセット
 *
 * TypeScript 向け fetch プリセット。
 * microsoft/TypeScript-Website モノレポの複数パッケージに分散した
 * 英語ドキュメントを統合取得する。
 *
 * 対象パッケージ:
 * - packages/documentation/copy/en/  (handbook, reference, tutorials 等)
 * - packages/tsconfig-reference/copy/en/  (tsconfig オプションリファレンス)
 * - packages/glossary/copy/en/  (用語集)
 *
 * 注意:
 * - デフォルトブランチは v2（main ではない）
 * - ファイル名にスペースを含む（URL エンコードが必要）
 */
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fetchMarkdown, processImages, writeLastFetched, resolveGithubRepo, fetchGithubTreeEntries, buildGithubRawUrl, } from "./shared.js";
/**
 * typescript-5 プリセットのメタ情報。
 * `resolvePresetMeta("typescript-5")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://github.com/microsoft/TypeScript-Website",
    branch: "v2",
    packageNames: ["typescript"],
};
/** モノレポ内のドキュメントパッケージ定義 */
const DOC_PACKAGES = [
    { prefix: "packages/documentation/copy/en/", outSubdir: "documentation" },
    { prefix: "packages/tsconfig-reference/copy/en/", outSubdir: "tsconfig-reference" },
    { prefix: "packages/glossary/copy/en/", outSubdir: "glossary" },
];
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export async function execute(src, outDir, options, stats, logger) {
    const repoInfo = resolveGithubRepo(src, "typescript-5", logger);
    if (!repoInfo)
        return stats;
    const { owner, repo } = repoInfo;
    const branch = src.branch ?? "v2";
    logger.info(`[${src.name}] GitHub Tree API でファイル一覧を取得中: ${owner}/${repo}@${branch}`);
    let tree;
    try {
        tree = fetchGithubTreeEntries(owner, repo, branch);
    }
    catch (err) {
        logger.error(`[${src.name}] GitHub Tree API の取得に失敗: ${String(err)}`);
        return stats;
    }
    // 各パッケージから英語 .md ファイルを収集
    const filesToFetch = [];
    for (const pkg of DOC_PACKAGES) {
        const pkgFiles = tree.filter((item) => {
            if (item.type !== "blob")
                return false;
            if (!item.path.endsWith(".md"))
                return false;
            return item.path.startsWith(pkg.prefix);
        });
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
        // raw.githubusercontent.com は Last-Modified ヘッダーを返さないため、
        // fetchMarkdown のインクリメンタル更新（304 判定）が機能しない。
        // existsSync による早期リターンで不要なリクエストを回避する。
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
            logger.debug?.(`[${src.name}] FAILED: ${file.outSubdir}/${file.relativePath}`);
            stats.failed++;
        }
    }
    // 画像処理
    if (options.images !== false) {
        await processImages(outDir, options.force ?? false, stats, logger, src.name);
    }
    writeLastFetched(outDir);
    return stats;
}
//# sourceMappingURL=typescript-5.js.map