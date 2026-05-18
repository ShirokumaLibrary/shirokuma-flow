/**
 * tailwindcss-4 プリセット。サイト固有の微調整が必要になればここに追記する。
 *
 * tailwindlabs/tailwindcss.com の `src/docs/` 配下 `.md` / `.mdx` を取得し、
 * ダウンロード後に `.mdx` を `transformMdxToMd` で Markdown 化して `.md` に
 * 置き換える（原 `.mdx` は削除）。MDX 変換は `tailwindcss-mdx-transform.ts` に
 * 閉じ込めた JSX→Markdown 静的変換。
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fetchGithubTree } from '../fetch-github-tree.js';
import { PRESETS } from '../presets.js';
import { processImages } from '../process-images.js';
import type { FetchStats } from '../stats.js';
import { transformMdxToMd } from './tailwindcss-mdx-transform.js';
import type { PresetExecuteParams } from './types.js';

const meta = PRESETS['tailwindcss-4'];

export async function execute(params: PresetExecuteParams): Promise<FetchStats> {
  const { src, outDir, options, stats, logger } = params;

  await fetchGithubTree({
    src: { ...src, url: src.url ?? meta.url },
    outDir,
    options,
    stats,
    presetName: 'tailwindcss-4',
    defaultBranch: meta.branch ?? 'main',
    defaultRepoPath: meta.repoPath,
    fileExtensions: ['.md', '.mdx'],
    logger,
  });

  if (!options.dryRun) {
    convertMdxFilesInPlace(outDir, src.name, logger);
  }

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

/**
 * `outDir` 配下の `.mdx` ファイルを再帰的に探し、`transformMdxToMd` で
 * Markdown 変換して同名の `.md` に書き出したうえで元 `.mdx` を削除する。
 */
function convertMdxFilesInPlace(
  outDir: string,
  sourceName: string,
  logger: PresetExecuteParams['logger'],
): void {
  if (!existsSync(outDir)) return;

  const mdxFiles = collectMdxFiles(outDir);
  if (mdxFiles.length === 0) return;

  logger.info(`[${sourceName}] ${mdxFiles.length} 件の MDX → Markdown 変換を実行中...`);
  let converted = 0;
  for (const mdxFile of mdxFiles) {
    try {
      const raw = readFileSync(mdxFile, 'utf-8');
      const transformed = transformMdxToMd(raw);
      const mdFile = mdxFile.replace(/\.mdx$/, '.md');
      writeFileSync(mdFile, transformed, 'utf-8');
      if (mdFile !== mdxFile) unlinkSync(mdxFile);
      converted++;
    } catch (err) {
      logger.debug?.(`[${sourceName}] MDX 変換失敗: ${mdxFile} — ${String(err)}`);
    }
  }
  logger.info(`[${sourceName}] ${converted} 件の MDX を Markdown に変換しました。`);
}

function collectMdxFiles(dir: string): string[] {
  const results: string[] = [];
  const walk = (current: string): void => {
    try {
      for (const entry of readdirSync(current)) {
        const full = join(current, entry);
        try {
          const st = statSync(full);
          if (st.isDirectory()) walk(full);
          else if (entry.endsWith('.mdx')) results.push(full);
        } catch {
          // skip unreadable entry
        }
      }
    } catch {
      // permission error などは無視
    }
  };
  walk(dir);
  return results;
}
