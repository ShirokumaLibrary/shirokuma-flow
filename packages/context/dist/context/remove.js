import { existsSync, rmSync } from 'node:fs';
import { resolveOutputDir } from './fs-helpers.js';
import { removeManifestEntry } from './manifest.js';
/**
 * 指定ソースのディレクトリを削除し、MANIFEST からも該当エントリを落とす。
 * 未存在は `removed: false` を返す（エラーではない）。
 * CLI 層の確認フローや error コード付与は consumer に委ねる。
 */
export function removeSource(params) {
    const outputDir = resolveOutputDir({
        projectPath: params.projectPath,
        sourceName: params.sourceName,
        sourceOutputDir: params.sourceOutputDir,
        docsRoot: params.docsRoot,
    });
    if (!existsSync(outputDir)) {
        return { removed: false, outputDir };
    }
    rmSync(outputDir, { recursive: true, force: true });
    removeManifestEntry(params.projectPath, params.sourceName, params.docsRoot);
    return { removed: true, outputDir };
}
//# sourceMappingURL=remove.js.map