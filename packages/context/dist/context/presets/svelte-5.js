/** svelte-5 プリセット。サイト固有の微調整が必要になればここに追記する。 */
import { resolve } from 'node:path';
import { fetchAndSaveLlmsTxt } from '../fetch-markdown.js';
import { fetchFullSplit } from '../fetch-full-split.js';
import { PRESETS } from '../presets.js';
import { processImages } from '../process-images.js';
const meta = PRESETS['svelte-5'];
export async function execute(params) {
    const { src, outDir, options, stats, logger } = params;
    const resolvedUrl = src.url ?? meta.url;
    const docsRoot = resolve(outDir, '..');
    logger.info(`[${src.name}] llms.txt を取得中: ${resolvedUrl}`);
    let llmsContent;
    try {
        llmsContent = await fetchAndSaveLlmsTxt(src.name, resolvedUrl, docsRoot, options.dryRun ?? false);
    }
    catch (err) {
        logger.error(`[${src.name}] llms.txt の取得に失敗: ${String(err)}`);
        return stats;
    }
    await fetchFullSplit({
        src: { ...src, url: resolvedUrl },
        outDir,
        options,
        stats,
        llmsContent,
        meta,
        logger,
    });
    if (options.images !== false) {
        await processImages({
            outDir,
            force: options.force ?? false,
            stats,
            logger,
            sourceName: src.name,
        });
    }
    return stats;
}
//# sourceMappingURL=svelte-5.js.map