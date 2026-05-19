import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_CONTEXTS_ROOT, countMarkdownFiles, readLastFetched, resolveOutputDir, } from './fs-helpers.js';
const MANIFEST_ROW_PATTERN = /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(\d+)\s*\|$/;
/**
 * MANIFEST.md のテーブル行をパースする。
 * ヘッダ行（`| ソース | ... |`）とセパレータ行（`|---|---|...`）は
 * `MANIFEST_ROW_PATTERN` の日付カラム（`\d{4}-\d{2}-\d{2}`）に一致しないので自然に除外される。
 */
export function parseManifest(content) {
    const entries = [];
    for (const line of content.split('\n')) {
        const match = MANIFEST_ROW_PATTERN.exec(line);
        if (!match)
            continue;
        const [, source, pkg, date, count] = match;
        if (!source || !pkg || !date || !count)
            continue;
        entries.push({
            source,
            package: pkg,
            lastFetched: date,
            fileCount: Number.parseInt(count, 10),
        });
    }
    return entries;
}
/**
 * ManifestEntry[] から MANIFEST.md の内容を生成する。ソース名昇順でソート。
 */
export function formatManifest(entries) {
    const lines = [
        '# Docs Manifest',
        '',
        'fetch 済みのドキュメントソース。`shirokuma-context search "<keyword>" --source <name> --section --limit 5` で検索可能。',
        '',
    ];
    if (entries.length === 0) {
        lines.push('(ソースなし)', '');
        return lines.join('\n');
    }
    lines.push('| ソース | パッケージ | Last Fetched | ファイル数 |', '|-------|----------|-------------|---------|');
    for (const entry of [...entries].sort((a, b) => a.source.localeCompare(b.source))) {
        lines.push(`| ${entry.source} | ${entry.package} | ${entry.lastFetched} | ${entry.fileCount} |`);
    }
    lines.push('');
    return lines.join('\n');
}
/**
 * MANIFEST.md を生成/更新する。既存 manifest の config 外エントリは、ディレクトリが
 * 残っていれば保持し、消えていれば evict する（stale エントリを残さない）。
 */
export async function writeManifest(params) {
    const docsRoot = resolveContextsRoot(params.projectPath, params.docsRoot);
    const manifestPath = join(docsRoot, 'MANIFEST.md');
    const existingEntries = readExistingManifest(manifestPath);
    const newEntries = [];
    for (const src of params.sources) {
        const outDir = resolveOutputDir({
            projectPath: params.projectPath,
            sourceName: src.name,
            sourceOutputDir: src.outputDir,
            docsRoot: params.docsRoot,
        });
        const last = readLastFetched(outDir);
        if (!last)
            continue;
        let packageName = src.name;
        if (params.resolvePackageName) {
            try {
                const resolved = await params.resolvePackageName(src.name);
                if (resolved)
                    packageName = resolved;
            }
            catch {
                // fallback to source name
            }
        }
        newEntries.push({
            source: src.name,
            package: packageName,
            lastFetched: last.date,
            fileCount: countMarkdownFiles(outDir),
        });
    }
    const newSourceNames = new Set(newEntries.map((e) => e.source));
    const survivingExisting = existingEntries.filter((e) => {
        if (newSourceNames.has(e.source))
            return false;
        const outDir = resolveOutputDir({
            projectPath: params.projectPath,
            sourceName: e.source,
            docsRoot: params.docsRoot,
        });
        return existsSync(outDir);
    });
    const merged = [...newEntries, ...survivingExisting];
    mkdirSync(docsRoot, { recursive: true });
    writeFileSync(manifestPath, formatManifest(merged), 'utf-8');
}
/**
 * MANIFEST.md から指定ソースのエントリを削除する。
 * manifest が存在しない / エントリが無い場合は no-op。
 */
export function removeManifestEntry(projectPath, sourceName, docsRoot) {
    const root = resolveContextsRoot(projectPath, docsRoot);
    const manifestPath = join(root, 'MANIFEST.md');
    if (!existsSync(manifestPath))
        return;
    const existing = readExistingManifest(manifestPath);
    const filtered = existing.filter((e) => e.source !== sourceName);
    if (filtered.length === existing.length)
        return;
    writeFileSync(manifestPath, formatManifest(filtered), 'utf-8');
}
/** contexts ルートを解決する（#2280: 旧 resolveDocsRoot） */
function resolveContextsRoot(projectPath, docsRoot) {
    return docsRoot ? resolve(projectPath, docsRoot) : resolve(projectPath, DEFAULT_CONTEXTS_ROOT);
}
function readExistingManifest(manifestPath) {
    if (!existsSync(manifestPath))
        return [];
    try {
        return parseManifest(readFileSync(manifestPath, 'utf-8'));
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=manifest.js.map