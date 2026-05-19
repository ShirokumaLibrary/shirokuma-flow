/**
 * drizzle-0 プリセット
 *
 * Drizzle ORM ドキュメント向け full-split fetch プリセット。
 * orm.drizzle.team/llms-full.txt を "Source: https://orm.drizzle.team/" 区切りで分割し、
 * metadata-to-frontmatter フォーマッタで frontmatter 形式に変換して保存する。
 */
import { resolve } from "node:path";
import { fetchAndSaveLlmsTxt, fetchFullSplit } from "../fetch.js";
/**
 * drizzle-0 プリセットのメタ情報。
 * `resolvePresetMeta("drizzle-0")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://orm.drizzle.team/llms.txt",
    fullUrl: "https://orm.drizzle.team/llms-full.txt",
    fetchStrategy: "full-split",
    linkFormat: "clean",
    splitPattern: "^Source: https://orm.drizzle.team/",
    sectionFormatter: "metadata-to-frontmatter",
    packageNames: ["drizzle-orm", "drizzle-kit"],
};
/**
 * プリセットエントリーポイント。
 * fetchSource() から動的 import で呼び出される。
 */
export async function execute(src, outDir, options, stats, logger) {
    const resolvedUrl = src.url ?? meta.url;
    const docsRoot = resolve(outDir, "..");
    logger.info(`[${src.name}] llms.txt を取得中: ${resolvedUrl}`);
    let llmsContent;
    try {
        llmsContent = await fetchAndSaveLlmsTxt(src.name, resolvedUrl, docsRoot, options.dryRun ?? false);
    }
    catch (err) {
        logger.error(`[${src.name}] llms.txt の取得に失敗: ${String(err)}`);
        return stats;
    }
    return fetchFullSplit({ ...src, url: resolvedUrl }, outDir, options, stats, logger, llmsContent, meta);
}
//# sourceMappingURL=drizzle-0.js.map