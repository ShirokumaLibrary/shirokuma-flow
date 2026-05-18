/** aws-cdk-2 プリセット。サイト固有の微調整が必要になればここに追記する。 */

import { PRESETS } from '../presets.js';
import { fetchGithubTree } from '../fetch-github-tree.js';
import type { FetchStats } from '../stats.js';
import type { PresetExecuteParams } from './types.js';

const meta = PRESETS['aws-cdk-2'];

export async function execute(params: PresetExecuteParams): Promise<FetchStats> {
  const { src, outDir, options, stats, logger } = params;
  return fetchGithubTree({
    src: { ...src, url: src.url ?? meta.url },
    outDir,
    options,
    stats,
    presetName: 'aws-cdk-2',
    defaultBranch: meta.branch ?? 'main',
    defaultRepoPath: meta.repoPath,
    fileExtensions: ['.adoc'],
    excludeFiles: ['attributes.txt', 'book.adoc'],
    logger,
  });
}
