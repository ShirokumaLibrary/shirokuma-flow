/**
 * supabase-2 プリセット
 *
 * Supabase 向け fetch プリセット。
 * supabase/supabase リポジトリの apps/docs/content/guides ディレクトリに
 * MDX ドキュメントが配置されている。
 *
 * ルートから recursive=1 すると ENOBUFS が発生するため、
 * GitHub Tree API を段階的に辿って guides サブツリーの SHA を解決し、
 * そのサブツリーに対して recursive=1 を適用してファイル一覧を取得する。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fetchMarkdown, processImages, writeLastFetched, resolveGithubRepo, resolveGithubTreeSha, fetchGithubSubtreeBySha, buildGithubRawUrl, } from "./shared.js";
import { transformMdxToMd } from "./tailwindcss-mdx-transform.js";
/**
 * supabase-2 プリセットのメタ情報。
 * `resolvePresetMeta("supabase-2")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://github.com/supabase/supabase",
    branch: "master",
    repoPath: "apps/docs/content/guides",
    packageNames: ["@supabase/supabase-js"],
};
/**
 * repoPath を段階的に解決し、最終サブツリーの SHA を返す。
 *
 * repoPath の各セグメントに対して順番に Tree API を呼び出し、
 * SHA を段階的に辿ることで巨大リポジトリの ENOBUFS を回避する。
 */
function resolveGuidesSha(owner, repo, branch, repoPath, logger, sourceName) {
    let currentRef = branch;
    const pathSegments = repoPath.split("/").filter(Boolean);
    for (const segment of pathSegments) {
        logger.info(`[${sourceName}] サブツリー SHA を解決中: ${currentRef} → ${segment}`);
        const sha = resolveGithubTreeSha(owner, repo, currentRef, segment);
        if (!sha) {
            logger.error(`[${sourceName}] サブツリー "${segment}" が見つかりません。` +
                ` (ref: ${currentRef})`);
            return null;
        }
        currentRef = sha;
    }
    return currentRef;
}
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export async function execute(src, outDir, options, stats, logger) {
    const repoInfo = resolveGithubRepo(src, "supabase-2", logger);
    if (!repoInfo)
        return stats;
    const { owner, repo } = repoInfo;
    const branch = src.branch ?? "master";
    const repoPath = Array.isArray(src.repoPath)
        ? src.repoPath.join("/")
        : (src.repoPath ?? "apps/docs/content/guides");
    logger.info(`[${src.name}] guides サブツリーの SHA を段階的に解決中: ${owner}/${repo}@${branch}`);
    // guides サブツリーの SHA を解決
    let guidesSha;
    try {
        guidesSha = resolveGuidesSha(owner, repo, branch, repoPath, logger, src.name);
    }
    catch (err) {
        logger.error(`[${src.name}] SHA 解決に失敗しました: ${String(err)}`);
        return stats;
    }
    if (!guidesSha)
        return stats;
    logger.info(`[${src.name}] guides SHA: ${guidesSha} — ファイル一覧を取得中...`);
    // SHA でサブツリーのファイル一覧を取得
    let tree;
    try {
        tree = fetchGithubSubtreeBySha(owner, repo, guidesSha);
    }
    catch (err) {
        logger.error(`[${src.name}] GitHub Tree API の取得に失敗: ${String(err)}`);
        return stats;
    }
    // .md / .mdx ファイルをフィルタ
    const mdFiles = tree.filter((item) => {
        if (item.type !== "blob")
            return false;
        return item.path.endsWith(".md") || item.path.endsWith(".mdx");
    });
    logger.info(`[${src.name}] ${mdFiles.length} 件の Markdown ファイルを取得します。`);
    if (options.dryRun) {
        logger.info(`[${src.name}] Dry-run: 以下のファイルを取得予定:`);
        for (const file of mdFiles) {
            // サブツリー内の相対パスを repoPath と結合して完全パスを構築
            const fullPath = `${repoPath}/${file.path}`;
            logger.info(`  ${buildGithubRawUrl(owner, repo, branch, fullPath)}`);
        }
        return stats;
    }
    mkdirSync(outDir, { recursive: true });
    const resolvedOutDir = resolve(outDir);
    for (const file of mdFiles) {
        const outFile = join(outDir, file.path);
        // パストラバーサル防止: outDir 外へのファイル書き込みを拒否
        if (!resolve(outFile).startsWith(resolvedOutDir + "/")) {
            logger.warn(`[${src.name}] パストラバーサル検出、スキップ: ${file.path}`);
            stats.failed++;
            continue;
        }
        // raw.githubusercontent.com は Last-Modified ヘッダーを返さないため、
        // existsSync による早期リターンで不要なリクエストを回避する。
        if (!options.force && existsSync(outFile)) {
            stats.skipped++;
            continue;
        }
        mkdirSync(dirname(outFile), { recursive: true });
        // guides サブツリー内の相対パスを使って完全 GitHub パスを構築
        const fullRepoPath = `${repoPath}/${file.path}`;
        const rawUrl = buildGithubRawUrl(owner, repo, branch, fullRepoPath);
        const result = await fetchMarkdown(rawUrl, outFile, options.force ?? false);
        if (result === "downloaded") {
            stats.downloaded++;
        }
        else if (result === "skipped") {
            stats.skipped++;
        }
        else {
            logger.debug?.(`[${src.name}] FAILED: ${file.path}`);
            stats.failed++;
        }
    }
    // MDX → Markdown 変換
    const mdxFiles = mdFiles.filter((f) => f.path.endsWith(".mdx"));
    if (mdxFiles.length > 0) {
        logger.info(`[${src.name}] ${mdxFiles.length} 件の MDX → Markdown 変換を実行中...`);
        let converted = 0;
        for (const file of mdxFiles) {
            const mdxFile = join(outDir, file.path);
            // パストラバーサル防止: outDir 外へのファイル操作を拒否
            if (!resolve(mdxFile).startsWith(resolvedOutDir + "/"))
                continue;
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
//# sourceMappingURL=supabase-2.js.map