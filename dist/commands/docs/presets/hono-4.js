/**
 * hono-4 プリセット
 *
 * Hono 4.x 向け full-split fetch プリセット。
 * hono.dev/llms-full.txt を H1 区切りで分割して保存する。
 *
 * llms.txt の各リンクがパス階層を持ち basename が衝突するため、
 * full-split 戦略を使用して llms-full.txt を H1 単位で分割する。
 */
import { resolve } from "node:path";
import { fetchAndSaveLlmsTxt, fetchFullSplit } from "../fetch.js";
/**
 * hono-4 プリセットのメタ情報。
 * `resolvePresetMeta("hono-4")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://hono.dev/llms.txt",
    fullUrl: "https://hono.dev/llms-full.txt",
    fetchStrategy: "full-split",
    linkFormat: "clean",
    splitPattern: "^# ",
    sectionFormatter: "passthrough",
    packageNames: ["hono"],
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
//# sourceMappingURL=hono-4.js.map