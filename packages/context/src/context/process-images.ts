import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve, sep } from 'node:path';
import type { Logger } from './logger.js';
import type { FetchStats } from './stats.js';
import { extractImageUrls, rewriteImagePaths } from './images.js';

function deriveLocalName(imgUrl: string): string {
  const withoutQuery = imgUrl.split('?')[0] ?? imgUrl;
  const withoutFragment = withoutQuery.split('#')[0] ?? withoutQuery;
  let raw = basename(withoutFragment);
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // decode 失敗時はそのまま raw を採用
  }
  return raw;
}

function isSafeLocalName(name: string): boolean {
  if (!name || name === '.' || name === '..') return false;
  if (name.startsWith('.')) return false;
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) return false;
  return true;
}

/**
 * SVG → Mermaid 変換ハンドラ。
 * ADR-0013 準拠のため本パッケージは子プロセスを起動せず、呼び出し側が
 * `claude` CLI 等を用いた変換を注入する。戻り値 `true` で `{name}.mermaid.md`
 * への書き出しが成功した扱いとし `stats.svgConverted` を加算する。
 */
export type SvgConverter = (svgFilePath: string) => boolean | Promise<boolean>;

export interface ProcessImagesParams {
  outDir: string;
  force: boolean;
  stats: FetchStats;
  logger: Logger;
  sourceName: string;
  svgConverter?: SvgConverter;
  /** SVG 変換数の上限（既定 20）。超過分は `svgKept` として残す */
  maxSvgConversions?: number;
}

const DEFAULT_MAX_SVG_CONVERSIONS = 20;

/**
 * `outDir` 内の `.md` ファイルに含まれる画像 URL を取得し、同ディレクトリに
 * 保存したうえで本文のリンクを `./{localName}` に書き換える。
 * SVG は `svgConverter` が与えられている場合のみ変換を試み、未提供または
 * 失敗時は `stats.svgKept` としてそのまま残す。ADR-0013 準拠。
 */
export async function processImages(params: ProcessImagesParams): Promise<void> {
  const {
    outDir,
    force,
    stats,
    logger,
    sourceName,
    svgConverter,
    maxSvgConversions = DEFAULT_MAX_SVG_CONVERSIONS,
  } = params;

  if (!existsSync(outDir)) return;

  const mdFiles = readdirSync(outDir).filter((f) => f.endsWith('.md'));
  let limitLogged = false;

  for (const mdFilename of mdFiles) {
    const mdFile = join(outDir, mdFilename);
    let content: string;
    try {
      content = readFileSync(mdFile, 'utf-8');
    } catch {
      continue;
    }

    const imageUrls = extractImageUrls(content);
    if (imageUrls.length === 0) continue;

    const rewrites = new Map<string, string>();

    const outDirAbs = resolve(outDir);

    for (const imgUrl of imageUrls) {
      const rawName = deriveLocalName(imgUrl);
      if (!isSafeLocalName(rawName)) {
        logger.debug?.(`[${sourceName}] SKIP (unsafe filename): ${rawName}`);
        stats.imagesFailed++;
        continue;
      }
      const imgOutFile = join(outDir, rawName);
      const imgOutFileAbs = resolve(imgOutFile);
      if (imgOutFileAbs !== join(outDirAbs, rawName) || !imgOutFileAbs.startsWith(outDirAbs + sep)) {
        logger.debug?.(`[${sourceName}] SKIP (path escapes outDir): ${rawName}`);
        stats.imagesFailed++;
        continue;
      }

      if (!force && existsSync(imgOutFile)) {
        stats.imagesSkipped++;
        continue;
      }

      try {
        const res = await fetch(imgUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(imgOutFile, buf);
        stats.imagesDownloaded++;
        rewrites.set(imgUrl, rawName);

        if (extname(rawName).toLowerCase() === '.svg') {
          const reachedLimit = stats.svgConverted + stats.svgKept >= maxSvgConversions;
          if (reachedLimit) {
            if (!limitLogged) {
              logger.info(
                `[${sourceName}] SVG 変換の上限 (${maxSvgConversions}) に達しました。残りの SVG はそのまま保持します。`,
              );
              limitLogged = true;
            }
            stats.svgKept++;
          } else if (svgConverter && (await svgConverter(imgOutFile))) {
            stats.svgConverted++;
          } else {
            stats.svgKept++;
          }
        }
      } catch {
        logger.debug?.(`[${sourceName}] FAILED (image): ${rawName}`);
        stats.imagesFailed++;
      }
    }

    if (rewrites.size > 0) {
      const newContent = rewriteImagePaths(content, rewrites);
      writeFileSync(mdFile, newContent, 'utf-8');
    }
  }
}
