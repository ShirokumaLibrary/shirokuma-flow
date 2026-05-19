/** remix-2 プリセット。サイト固有の微調整が必要になればここに追記する。 */
import { fetchGithubTree } from '../fetch-github-tree.js';
import { PRESETS } from '../presets.js';
import { processImages } from '../process-images.js';
const meta = PRESETS['remix-2'];
export async function execute(params) {
    const { src, outDir, options, stats, logger } = params;
    await fetchGithubTree({
        src: { ...src, url: src.url ?? meta.url },
        outDir,
        options,
        stats,
        presetName: 'remix-2',
        defaultBranch: meta.branch ?? 'v2',
        defaultRepoPath: meta.repoPath,
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
//# sourceMappingURL=remix-2.js.map