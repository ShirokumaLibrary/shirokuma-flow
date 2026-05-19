import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fetchMarkdown, writeLastFetched } from './fetch-markdown.js';
import { parseLlmsTxt } from './llms-txt.js';
import { NOOP_LOGGER } from './logger.js';
/**
 * `individual` fetch strategy の実装。
 * llms.txt 内の Markdown リンクから **ソースと同一ドメイン** の URL のみを対象に
 * 並列ではなく逐次 fetch する（shirokuma-flow 原版の挙動を維持）。
 *
 * `linkFormat` による URL 変換:
 *   - `md`: リンク URL をそのまま使用（末尾が `.md` でない場合は skip）
 *   - `clean`: 末尾 `/` を除いて `.md` を付加
 *
 * `stripHeaderPattern` / `stripLinePattern` がメタに設定されている場合、
 * 取得したファイルから該当パターンを除去してから保存し直す。
 *
 * 画像処理 (`processImages`) は **呼び出さない** — caller が必要に応じて
 * 別途実行する設計（1 つの関数に責務を集約しない）。
 */
export async function fetchIndividual(params) {
    const { src, outDir, options, stats, llmsContent, meta } = params;
    const logger = params.logger ?? NOOP_LOGGER;
    if (!src.url) {
        logger.error(`[${src.name}] individual プリセットには url が必要ですが、設定されていません。`);
        return stats;
    }
    const resolvedUrl = src.url;
    const linkFormat = src.linkFormat ?? meta.linkFormat ?? 'md';
    const sourceHost = tryHostname(resolvedUrl);
    if (!sourceHost) {
        logger.error(`[${src.name}] src.url が解析できません: ${resolvedUrl}`);
        return stats;
    }
    const resolvedUrls = parseLlmsTxt(llmsContent, resolvedUrl)
        .filter((url) => tryHostname(url) === sourceHost)
        .map((url) => adaptLinkFormat(url, linkFormat))
        .filter((url) => url.endsWith('.md') && !url.endsWith('.txt.md'));
    logger.info(`[${src.name}] ${resolvedUrls.length} 件の Markdown を取得します。`);
    if (options.dryRun) {
        logger.info(`[${src.name}] Dry-run: 以下の URL を取得予定:`);
        for (const url of resolvedUrls)
            logger.info(`  ${url}`);
        return stats;
    }
    mkdirSync(outDir, { recursive: true });
    const stripHeader = meta.stripHeaderPattern ? new RegExp(meta.stripHeaderPattern) : null;
    const stripLine = meta.stripLinePattern ? new RegExp(meta.stripLinePattern) : null;
    for (const url of resolvedUrls) {
        const filename = basename(url);
        const outFile = join(outDir, filename);
        const result = await fetchMarkdown(url, outFile, options.force ?? false, logger);
        if (result === 'downloaded') {
            stats.downloaded++;
            if (stripHeader || stripLine) {
                applyStripPatterns(outFile, stripHeader, stripLine, src.name, filename, logger);
            }
        }
        else if (result === 'skipped') {
            stats.skipped++;
        }
        else {
            logger.debug?.(`[${src.name}] FAILED: ${filename}`);
            stats.failed++;
        }
    }
    writeLastFetched(outDir);
    return stats;
}
function adaptLinkFormat(url, linkFormat) {
    if (linkFormat !== 'clean' || url.endsWith('.md'))
        return url;
    const trimmed = url.endsWith('/') ? url.slice(0, -1) : url;
    return `${trimmed}.md`;
}
/**
 * `new URL(url).hostname` を try/catch でラップ。`host` ではなく `hostname` を使う
 * ことで同一ドメイン判定が port の有無に左右されないようにしている。
 */
function tryHostname(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        return null;
    }
}
function applyStripPatterns(outFile, stripHeader, stripLine, sourceName, filename, logger) {
    try {
        let content = readFileSync(outFile, 'utf-8');
        if (stripHeader)
            content = content.replace(stripHeader, '');
        if (stripLine) {
            content = content
                .split('\n')
                .filter((line) => !stripLine.test(line))
                .join('\n');
        }
        writeFileSync(outFile, content, 'utf-8');
    }
    catch (err) {
        logger.debug?.(`[${sourceName}] パターン除去でエラー: ${filename} — ${err.message}`);
    }
}
//# sourceMappingURL=fetch-individual.js.map