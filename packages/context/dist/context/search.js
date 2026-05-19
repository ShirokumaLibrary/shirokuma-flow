import { existsSync, readFileSync } from 'node:fs';
import { collectMarkdownFiles, discoverFilesystemSources, resolveOutputDir } from './fs-helpers.js';
/**
 * ローカル fetch 済みドキュメント横断検索（pure data）。
 * `query` を正規表現 / substring 検索でマッチさせ、`SearchMatch[]` を返す。
 *
 * CLI 側は `logger.error` や非 0 exit の判定をここから自由に行える。
 */
export function search(params) {
    const allSources = params.sources ?? discoverFilesystemSources(params.projectPath, params.docsRoot);
    if (allSources.length === 0) {
        return { matches: [] };
    }
    let targets = allSources;
    if (params.source) {
        targets = allSources.filter((s) => s.name === params.source);
        if (targets.length === 0) {
            return { matches: [], sourceNotFound: true };
        }
    }
    const pattern = buildPattern(params.query, params.regex ?? false);
    const contextLines = params.context ?? 0;
    const limit = params.limit;
    const sectionMode = params.section ?? false;
    const matches = [];
    const seenSectionKeys = new Set();
    outer: for (const src of targets) {
        const outDir = resolveOutputDir({
            projectPath: params.projectPath,
            sourceName: src.name,
            sourceOutputDir: src.outputDir,
            docsRoot: params.docsRoot,
        });
        if (!existsSync(outDir))
            continue;
        for (const filePath of collectMarkdownFiles(outDir)) {
            let fileContent;
            for (const m of searchFile(filePath, pattern, contextLines)) {
                const entry = {
                    source: src.name,
                    file: filePath,
                    line: m.line,
                    text: m.text,
                    context: m.context,
                };
                if (sectionMode) {
                    if (fileContent === undefined) {
                        try {
                            fileContent = readFileSync(filePath, 'utf-8');
                        }
                        catch {
                            fileContent = '';
                        }
                    }
                    const section = extractSection(fileContent, m.line);
                    const sectionKey = `${filePath}::${section.startLine}`;
                    if (seenSectionKeys.has(sectionKey))
                        continue;
                    seenSectionKeys.add(sectionKey);
                    entry.sectionContent = section.content;
                }
                matches.push(entry);
                if (limit !== undefined && matches.length >= limit)
                    break outer;
            }
        }
    }
    return { matches };
}
/**
 * 1 ファイル内を検索して行ごとのマッチを返す。`context` > 0 で前後行を付ける。
 * 読み込み失敗時は空配列（caller には読めなかった事実だけ伝わる）。
 */
export function searchFile(filePath, pattern, contextLines) {
    let content;
    try {
        content = readFileSync(filePath, 'utf-8');
    }
    catch {
        return [];
    }
    const lines = content.split('\n');
    const results = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (!pattern.test(line))
            continue;
        const ctx = [];
        if (contextLines > 0) {
            const start = Math.max(0, i - contextLines);
            const end = Math.min(lines.length - 1, i + contextLines);
            for (let j = start; j <= end; j++) {
                ctx.push(`${j + 1}: ${lines[j] ?? ''}`);
            }
        }
        results.push({ line: i + 1, text: line, context: ctx });
    }
    return results;
}
/**
 * `lineNumber`（1-based）を含む `^#` 見出しセクションの全文を抽出する。
 * 見出しが無ければファイル全体、最初の見出しより前ならファイル先頭〜最初の見出しまで。
 */
export function extractSection(content, lineNumber) {
    const lines = content.split('\n');
    const targetIndex = lineNumber - 1;
    const headingIndices = [];
    for (let i = 0; i < lines.length; i++) {
        if (/^#/.test(lines[i] ?? ''))
            headingIndices.push(i);
    }
    if (headingIndices.length === 0)
        return { content, startLine: 1 };
    const firstHeading = headingIndices[0];
    if (targetIndex < firstHeading) {
        return { content: lines.slice(0, firstHeading).join('\n'), startLine: 1 };
    }
    for (let i = 0; i < headingIndices.length; i++) {
        const headingIdx = headingIndices[i];
        const nextHeadingIdx = headingIndices[i + 1] ?? lines.length;
        if (targetIndex < nextHeadingIdx) {
            return {
                content: lines.slice(headingIdx, nextHeadingIdx).join('\n'),
                startLine: headingIdx + 1,
            };
        }
    }
    // unreachable: headingIndices[length-1] <= targetIndex < lines.length は上で必ず return される
    /* c8 ignore next */
    return { content, startLine: 1 };
}
function buildPattern(query, regex) {
    if (regex)
        return new RegExp(query, 'i');
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
}
//# sourceMappingURL=search.js.map