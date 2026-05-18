/** deno-2 プリセット。サイト固有の微調整が必要になればここに追記する。 */

import { resolve } from 'node:path';
import { fetchAndSaveLlmsTxt } from '../fetch-markdown.js';
import { fetchIndividual } from '../fetch-individual.js';
import { PRESETS } from '../presets.js';
import { processImages } from '../process-images.js';
import type { FetchStats } from '../stats.js';
import type { PresetExecuteParams } from './types.js';

const meta = PRESETS['deno-2'];

export async function execute(params: PresetExecuteParams): Promise<FetchStats> {
  const { src, outDir, options, stats, logger } = params;
  const resolvedUrl = src.url ?? meta.url;
  const docsRoot = resolve(outDir, '..');

  logger.info(`[${src.name}] llms.txt を取得中: ${resolvedUrl}`);

  let llmsContent: string;
  try {
    llmsContent = await fetchAndSaveLlmsTxt(
      src.name,
      resolvedUrl,
      docsRoot,
      options.dryRun ?? false,
    );
  } catch (err) {
    logger.error(`[${src.name}] llms.txt の取得に失敗: ${String(err)}`);
    return stats;
  }

  await fetchIndividual({
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
