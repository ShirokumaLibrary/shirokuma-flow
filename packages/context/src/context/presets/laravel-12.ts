/** laravel-12 プリセット。サイト固有の微調整が必要になればここに追記する。 */

import { fetchGithubTree } from '../fetch-github-tree.js';
import { PRESETS } from '../presets.js';
import { processImages } from '../process-images.js';
import type { FetchStats } from '../stats.js';
import type { PresetExecuteParams } from './types.js';

const meta = PRESETS['laravel-12'];

export async function execute(params: PresetExecuteParams): Promise<FetchStats> {
  const { src, outDir, options, stats, logger } = params;

  await fetchGithubTree({
    src: { ...src, url: src.url ?? meta.url },
    outDir,
    options,
    stats,
    presetName: 'laravel-12',
    defaultBranch: meta.branch ?? '12.x',
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
