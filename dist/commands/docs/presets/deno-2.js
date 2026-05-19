/**
 * deno-2 プリセット
 *
 * Deno 2 ドキュメント向け individual fetch プリセット。
 * docs.deno.com/llms.txt から各ページを個別に取得する。
 * llms-full.txt も提供されているが、individual プリセットを使用する。
 */
import { resolve } from "node:path";
import { fetchAndSaveLlmsTxt, fetchIndividual } from "../fetch.js";
/**
 * deno-2 プリセットのメタ情報。
 * `resolvePresetMeta("deno-2")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://docs.deno.com/llms.txt",
    fetchStrategy: "individual",
    linkFormat: "clean",
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
//# sourceMappingURL=deno-2.js.map