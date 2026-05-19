/**
 * turborepo-2 プリセット
 *
 * Turborepo 2 ドキュメント向け full-split fetch プリセット。
 * turborepo.dev/llms-full.txt を frontmatter 区切り（---\ntitle: ）で分割して保存する。
 */
import { resolve } from "node:path";
import { fetchAndSaveLlmsTxt, fetchFullSplit } from "../fetch.js";
/**
 * turborepo-2 プリセットのメタ情報。
 * `resolvePresetMeta("turborepo-2")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://turborepo.dev/llms.txt",
    fullUrl: "https://turborepo.dev/llms-full.txt",
    fetchStrategy: "full-split",
    linkFormat: "md",
    splitPattern: "^---\\ntitle: ",
    sectionFormatter: "passthrough",
    packageNames: ["turbo"],
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
//# sourceMappingURL=turborepo-2.js.map