/**
 * handlebars-4 プリセット
 *
 * Handlebars 向け fetch プリセット。
 * handlebars-lang/docs リポジトリの src/ 配下に Markdown ドキュメントを
 * 配置しているソース専用。
 *
 * src/ko/, src/zh/ に韓国語・中国語の翻訳ファイルがあるため、
 * 英語版のみを取得するようフィルタする。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fetchMarkdown, processImages, writeLastFetched, resolveGithubRepo, fetchGithubTreeEntries, buildGithubRawUrl, } from "./shared.js";
/**
 * handlebars-4 プリセットのメタ情報。
 * `resolvePresetMeta("handlebars-4")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://github.com/handlebars-lang/docs",
    branch: "master",
    repoPath: "src",
    packageNames: ["handlebars"],
};
/** 非英語翻訳・playground データ・VitePress 内部ファイルを除外するパターン */
const EXCLUDE_PATH = /\/(ko|zh|examples|\.vitepress)\//;
/** VitePress / Vue 固有の記法を除去する行パターン */
const STRIP_LINE_PATTERNS = [
    /^:::.*$/, // ::: v-pre, ::: warning, ::: danger, ::: tip, :::
    /^<Example\s/, // <Example ... />
    /^<\/?Flex>/, // <Flex>, </Flex>
    /^<script\s+setup>/, // <script setup>
    /^<\/script>/, // </script>
];
/**
 * VitePress / Vue 固有の記法を含む行を除去する。
 */
function stripVitepressArtifacts(filePath) {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const cleaned = lines
        .filter((line) => !STRIP_LINE_PATTERNS.some((p) => p.test(line)))
        .join("\n");
    if (cleaned !== content) {
        writeFileSync(filePath, cleaned, "utf-8");
    }
}
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export async function execute(src, outDir, options, stats, logger) {
    const repoInfo = resolveGithubRepo(src, "handlebars-4", logger);
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
        if (EXCLUDE_PATH.test(item.path))
            return false;
        if (item.path.endsWith("/playground.md"))
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
            stripVitepressArtifacts(outFile);
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
//# sourceMappingURL=handlebars-4.js.map