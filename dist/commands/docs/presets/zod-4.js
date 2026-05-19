/**
 * zod-4 プリセット
 *
 * Zod 4 ドキュメント向け full-split fetch プリセット。
 * zod.dev/llms-full.txt を H1 区切りで分割して保存する。
 * fumadocs-ui / @/components からの import 行を除去する。
 */
import { resolve } from "node:path";
import { fetchAndSaveLlmsTxt, fetchFullSplit } from "../fetch.js";
/**
 * zod-4 プリセットのメタ情報。
 * `resolvePresetMeta("zod-4")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://zod.dev/llms.txt",
    fullUrl: "https://zod.dev/llms-full.txt",
    fetchStrategy: "full-split",
    linkFormat: "clean",
    splitPattern: "^# ",
    sectionFormatter: "passthrough",
    stripLinePattern: "^import .+ from ['\"](?:fumadocs-ui|@/components)/",
    packageNames: ["zod"],
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
//# sourceMappingURL=zod-4.js.map