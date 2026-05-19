/**
 * payload-3 プリセット
 *
 * Payload CMS 3.x 向け full-split fetch プリセット。
 * payloadcms.com/llms-full.txt を H1 区切りで分割して保存する。
 *
 * llms.txt の各リンクがパス階層を持ち basename が衝突するため、
 * full-split 戦略を使用して llms-full.txt を H1 単位で分割する。
 *
 * stripLinePattern で Source: 行（ページ URL 参照）と
 * JSX コンポーネント（<YouTube id=... /> 等）を除去する。
 */
import { resolve } from "node:path";
import { fetchAndSaveLlmsTxt, fetchFullSplit } from "../fetch.js";
/**
 * payload-3 プリセットのメタ情報。
 * `resolvePresetMeta("payload-3")` が動的 import でこれを取得する。
 */
export const meta = {
    url: "https://payloadcms.com/llms.txt",
    fullUrl: "https://payloadcms.com/llms-full.txt",
    fetchStrategy: "full-split",
    linkFormat: "clean",
    splitPattern: "^# ",
    sectionFormatter: "passthrough",
    // Source: 行と JSX コンポーネント（開始タグ・自己終了）を除去する
    // - Source: https://... 行（ページ URL 参照）
    // - <ComponentName（大文字始まりの JSX タグ）
    // - /> 行（JSX 自己終了タグ）
    stripLinePattern: "^(Source:\\s+https?://|<[A-Z][A-Za-z]+(\\s|[/>]|$)|\\s*/>\\s*$)",
    packageNames: ["payload"],
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
//# sourceMappingURL=payload-3.js.map