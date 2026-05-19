/**
 * react-19 プリセット
 *
 * React 19 ドキュメント向け individual fetch プリセット。
 * react.dev/llms.txt から各ページを個別に取得する。
 */
import { resolve } from "node:path";
import { fetchAndSaveLlmsTxt, fetchIndividual } from "../fetch.js";
/**
 * react-19 プリセットのメタ情報。
 * `resolvePresetMeta("react-19")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://react.dev/llms.txt",
    fetchStrategy: "individual",
    linkFormat: "md",
    packageNames: ["react", "react-dom"],
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
//# sourceMappingURL=react-19.js.map