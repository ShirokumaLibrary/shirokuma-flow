/**
 * aws-cdk-2 プリセット
 *
 * AWS CDK v2 ガイドドキュメント向け fetch プリセット。
 * awsdocs/aws-cdk-guide リポジトリの v2/guide/ 配下に AsciiDoc 形式（.adoc）で
 * ドキュメントが配置されているソース専用。
 *
 * attributes.txt（変数定義ファイル）および book.adoc（目次集約ファイル）は
 * ドキュメントコンテンツではないため除外する。
 * 画像処理は .adoc の image:: 記法のため skip する。
 */
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fetchMarkdown, writeLastFetched, resolveGithubRepo, fetchGithubTreeEntries, buildGithubRawUrl, } from "./shared.js";
/**
 * aws-cdk-2 プリセットのメタ情報。
 * `resolvePresetMeta("aws-cdk-2")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://github.com/awsdocs/aws-cdk-guide",
    branch: "main",
    repoPath: "v2/guide",
    packageNames: ["aws-cdk-lib", "aws-cdk"],
};
/** ドキュメントコンテンツではないファイルを除外するパターン */
const EXCLUDE_FILES = new Set(["attributes.txt", "book.adoc"]);
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export async function execute(src, outDir, options, stats, logger) {
    const repoInfo = resolveGithubRepo(src, "aws-cdk-2", logger);
    if (!repoInfo)
        return stats;
    const { owner, repo } = repoInfo;
    const branch = src.branch ?? "main";
    const repoPath = src.repoPath ?? "v2/guide";
    logger.info(`[${src.name}] GitHub Tree API でファイル一覧を取得中: ${owner}/${repo}@${branch}`);
    let tree;
    try {
        tree = fetchGithubTreeEntries(owner, repo, branch);
    }
    catch (err) {
        logger.error(`[${src.name}] GitHub Tree API の取得に失敗: ${String(err)}`);
        return stats;
    }
    const adocFiles = tree.filter((item) => {
        if (item.type !== "blob")
            return false;
        if (!item.path.endsWith(".adoc"))
            return false;
        const filename = item.path.split("/").pop() ?? "";
        if (EXCLUDE_FILES.has(filename))
            return false;
        if (repoPath) {
            return item.path.startsWith(repoPath + "/") || item.path === repoPath;
        }
        return true;
    });
    logger.info(`[${src.name}] ${adocFiles.length} 件の AsciiDoc ファイルを取得します。`);
    if (options.dryRun) {
        logger.info(`[${src.name}] Dry-run: 以下のファイルを取得予定:`);
        for (const file of adocFiles) {
            logger.info(`  ${buildGithubRawUrl(owner, repo, branch, file.path)}`);
        }
        return stats;
    }
    mkdirSync(outDir, { recursive: true });
    for (const file of adocFiles) {
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
    // .adoc の image:: 記法は processImages と互換性がないため skip する
    writeLastFetched(outDir);
    return stats;
}
//# sourceMappingURL=aws-cdk-2.js.map