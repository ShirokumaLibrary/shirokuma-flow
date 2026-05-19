import { countMarkdownFiles, discoverFilesystemSources, readLastFetched, resolveOutputDir, } from './fs-helpers.js';
/**
 * fetch 済みドキュメントソースの状態を列挙する（pure data）。
 * CLI 側で JSON / テーブル整形する（ADR-0012）。
 */
export function listSources(params) {
    const sources = params.sources ?? discoverFilesystemSources(params.projectPath, params.docsRoot);
    return sources.map((src) => {
        const outputDir = resolveOutputDir({
            projectPath: params.projectPath,
            sourceName: src.name,
            sourceOutputDir: src.outputDir,
            docsRoot: params.docsRoot,
        });
        const last = readLastFetched(outputDir);
        return {
            name: src.name,
            ...(src.url !== undefined ? { url: src.url } : {}),
            outputDir,
            lastFetched: last?.iso ?? null,
            fileCount: countMarkdownFiles(outputDir),
        };
    });
}
//# sourceMappingURL=list.js.map