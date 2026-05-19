/**
 * kysely-0 プリセット
 *
 * Kysely 向け full-split fetch プリセット。
 * kysely.dev/llms-full.txt を H1 区切りで分割して保存する。
 *
 * llms.txt の各リンクがパス階層を持ち basename が衝突するため、
 * full-split 戦略を使用して llms-full.txt を H1 単位で分割する。
 */
import { resolve } from "node:path";
import { fetchAndSaveLlmsTxt, fetchFullSplit } from "../fetch.js";
/**
 * kysely-0 プリセットのメタ情報。
 * `resolvePresetMeta("kysely-0")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://kysely.dev/llms.txt",
    fullUrl: "https://kysely.dev/llms-full.txt",
    fetchStrategy: "full-split",
    linkFormat: "clean",
    splitPattern: "^# ",
    sectionFormatter: "passthrough",
    packageNames: ["kysely"],
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
//# sourceMappingURL=kysely-0.js.map