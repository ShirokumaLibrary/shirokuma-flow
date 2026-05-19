/** cytoscape-3 プリセット。サイト固有の微調整が必要になればここに追記する。 */
import { fetchGithubTree } from '../fetch-github-tree.js';
import { PRESETS } from '../presets.js';
import { processImages } from '../process-images.js';
const meta = PRESETS['cytoscape-3'];
export async function execute(params) {
    const { src, outDir, options, stats, logger } = params;
    await fetchGithubTree({
        src: { ...src, url: src.url ?? meta.url },
        outDir,
        options,
        stats,
        presetName: 'cytoscape-3',
        defaultBranch: meta.branch ?? 'master',
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
//# sourceMappingURL=cytoscape-3.js.map