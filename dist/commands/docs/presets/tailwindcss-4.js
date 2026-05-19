/**
 * tailwindcss-4 プリセット
 *
 * Tailwind CSS 向け fetch プリセット。
 * tailwindlabs/tailwindcss.com のように、GitHub リポジトリの指定ディレクトリに
 * Markdown ドキュメントを直接配置しているソース専用。
 *
 * 別の GitHub ベースのドキュメントソースが追加される場合は、
 * shared.ts の GitHub ユーティリティを利用して新しいプリセットファイルを作成すること。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fetchMarkdown, processImages, writeLastFetched, resolveGithubRepo, fetchGithubTreeEntries, buildGithubRawUrl, } from "./shared.js";
import { transformMdxToMd } from "./tailwindcss-mdx-transform.js";
/**
 * tailwindcss-4 プリセットのメタ情報。
 * `resolvePresetMeta("tailwindcss-4")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://github.com/tailwindlabs/tailwindcss.com",
    branch: "main",
    repoPath: "src/docs",
    packageNames: ["tailwindcss"],
};
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export async function execute(src, outDir, options, stats, logger) {
    const repoInfo = resolveGithubRepo(src, "tailwindcss-4", logger);
    if (!repoInfo)
        return stats;
    const { owner, repo } = repoInfo;
    const branch = src.branch ?? "main";
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
    // repoPath 配下の .md / .mdx ファイルをフィルタ
    const mdFiles = tree.filter((item) => {
        if (item.type !== "blob")
            return false;
        if (!item.path.endsWith(".md") && !item.path.endsWith(".mdx"))
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
            logger.debug?.(`[${src.name}] FAILED: ${relativePath}`);
            stats.failed++;
        }
    }
    // MDX → Markdown 変換
    const mdxFiles = mdFiles.filter((f) => f.path.endsWith(".mdx"));
    if (mdxFiles.length > 0) {
        logger.info(`[${src.name}] ${mdxFiles.length} 件の MDX → Markdown 変換を実行中...`);
        let converted = 0;
        for (const file of mdxFiles) {
            const relativePath = repoPath ? file.path.slice(repoPath.length + 1) : file.path;
            const mdxFile = join(outDir, relativePath);
            const mdFile = mdxFile.replace(/\.mdx$/, ".md");
            if (!existsSync(mdxFile))
                continue;
            const raw = readFileSync(mdxFile, "utf-8");
            const transformed = transformMdxToMd(raw);
            writeFileSync(mdFile, transformed, "utf-8");
            // 元の .mdx を削除
            if (mdFile !== mdxFile) {
                unlinkSync(mdxFile);
            }
            converted++;
        }
        logger.info(`[${src.name}] ${converted} 件の MDX を Markdown に変換しました。`);
    }
    // 画像処理
    if (options.images !== false) {
        await processImages(outDir, options.force ?? false, stats, logger, src.name);
    }
    writeLastFetched(outDir);
    return stats;
}
//# sourceMappingURL=tailwindcss-4.js.map