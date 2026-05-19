import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeLastFetched } from './fetch-markdown.js';
import { buildTitleMap } from './llms-txt.js';
import { NOOP_LOGGER } from './logger.js';
import { deriveSectionFilename, resolveSectionFormatter } from './section-format.js';
/**
 * `full-split` fetch strategy の実装。
 * `llms-full.txt` を取得し `meta.splitPattern` で複数セクションに分割、
 * 各セクションを `{slug}.md` として保存する。
 *
 * 分割ロジック:
 *   - `matchAll` で分割境界を収集し、境界 → 次境界の範囲を 1 セクションとする
 *   - 最初の境界より前にコンテンツがあればそれも 1 セクション
 *   - 空白のみのセクションはスキップ
 *   - セクション整形は `meta.sectionFormatter`（未指定は passthrough）
 *
 * `llmsContent` は caller が `fetchAndSaveLlmsTxt` で取得して渡す
 * （full-split でも llms.txt からタイトル map を作るため）。
 */
export async function fetchFullSplit(params) {
    const { src, outDir, options, stats, llmsContent, meta } = params;
    const logger = params.logger ?? NOOP_LOGGER;
    const fullUrl = src.fullUrl ?? meta.fullUrl;
    if (!fullUrl) {
        logger.error(`[${src.name}] fetchStrategy: full-split には fullUrl が必要です。`);
        return stats;
    }
    logger.info(`[${src.name}] llms-full.txt を取得中: ${fullUrl}`);
    let fullContent;
    try {
        const res = await fetch(fullUrl);
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        fullContent = await res.text();
    }
    catch (err) {
        logger.error(`[${src.name}] llms-full.txt の取得に失敗: ${err.message}`);
        return stats;
    }
    if (options.dryRun) {
        logger.info(`[${src.name}] Dry-run: llms-full.txt を分割して保存予定`);
        return stats;
    }
    mkdirSync(outDir, { recursive: true });
    const splitPatternStr = src.splitPattern ?? meta.splitPattern;
    let splitPattern;
    try {
        splitPattern = new RegExp(splitPatternStr, 'gm');
    }
    catch (err) {
        logger.error(`[${src.name}] 無効な splitPattern です: "${splitPatternStr}" — ${err.message}`);
        return stats;
    }
    const sections = splitSections(fullContent, splitPattern);
    const titleMap = buildTitleMap(llmsContent);
    const formatter = resolveSectionFormatter(meta.sectionFormatter);
    const stripLine = meta.stripLinePattern ? new RegExp(meta.stripLinePattern) : null;
    const usedNames = new Set();
    for (let i = 0; i < sections.length; i++) {
        const raw = sections[i];
        if (raw === undefined)
            continue;
        let section = formatter(raw, titleMap);
        if (stripLine) {
            section = section
                .split('\n')
                .filter((line) => !stripLine.test(line))
                .join('\n');
        }
        const filename = deriveSectionFilename(section, i, usedNames);
        const outFile = join(outDir, `${filename}.md`);
        if (!options.force && existsSync(outFile)) {
            stats.skipped++;
            continue;
        }
        writeFileSync(outFile, section, 'utf-8');
        stats.downloaded++;
    }
    writeLastFetched(outDir);
    return stats;
}
function splitSections(content, pattern) {
    const matches = [...content.matchAll(pattern)];
    const out = [];
    if (matches.length === 0) {
        if (content.trim())
            out.push(content);
        return out;
    }
    const firstIdx = matches[0]?.index ?? 0;
    const before = content.slice(0, firstIdx);
    if (before.trim())
        out.push(before);
    for (let i = 0; i < matches.length; i++) {
        const start = matches[i]?.index ?? 0;
        const end = matches[i + 1]?.index ?? content.length;
        const section = content.slice(start, end);
        if (section.trim())
            out.push(section);
    }
    return out;
}
//# sourceMappingURL=fetch-full-split.js.map