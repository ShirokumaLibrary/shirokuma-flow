/**
 * astro-6 プリセット
 *
 * Astro 6 ドキュメント向け full-split fetch プリセット。
 * docs.astro.build/llms-full.txt を H1 区切りで分割して保存する。
 */
import { resolve } from "node:path";
import { fetchAndSaveLlmsTxt, fetchFullSplit } from "../fetch.js";
/**
 * astro-6 プリセットのメタ情報。
 * `resolvePresetMeta("astro-6")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://docs.astro.build/llms.txt",
    fullUrl: "https://docs.astro.build/llms-full.txt",
    fetchStrategy: "full-split",
    linkFormat: "clean",
    splitPattern: "^# ",
    sectionFormatter: "passthrough",
    packageNames: ["astro"],
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
//# sourceMappingURL=astro-6.js.map