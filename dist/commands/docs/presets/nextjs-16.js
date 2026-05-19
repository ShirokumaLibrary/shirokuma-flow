/**
 * nextjs-16 プリセット
 *
 * Next.js 16 ドキュメント向け individual fetch プリセット。
 * nextjs.org/docs/llms.txt から各ページを個別に取得する。
 */
import { resolve } from "node:path";
import { fetchAndSaveLlmsTxt, fetchIndividual } from "../fetch.js";
/**
 * nextjs-16 プリセットのメタ情報。
 * `resolvePresetMeta("nextjs-16")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://nextjs.org/docs/llms.txt",
    fetchStrategy: "individual",
    linkFormat: "clean",
    packageNames: ["next"],
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
    return fetchIndividual({ ...src, url: resolvedUrl }, outDir, options, stats, logger, llmsContent, meta);
}
//# sourceMappingURL=nextjs-16.js.map