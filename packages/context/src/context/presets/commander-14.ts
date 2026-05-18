/** commander-14 プリセット。サイト固有の微調整が必要になればここに追記する。 */

import { fetchGithubTree } from '../fetch-github-tree.js';
import { PRESETS } from '../presets.js';
import { processImages } from '../process-images.js';
import type { FetchStats } from '../stats.js';
import type { PresetExecuteParams } from './types.js';

const meta = PRESETS['commander-14'];
const EXCLUDE_LANG_DIR = /\/zh-CN\//;

export async function execute(params: PresetExecuteParams): Promise<FetchStats> {
  const { src, outDir, options, stats, logger } = params;

  await fetchGithubTree({
    src: { ...src, url: src.url ?? meta.url },
    outDir,
    options,
    stats,
    presetName: 'commander-14',
    defaultBranch: meta.branch ?? 'master',
    defaultRepoPath: meta.repoPath,
    excludePathPattern: EXCLUDE_LANG_DIR,
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
