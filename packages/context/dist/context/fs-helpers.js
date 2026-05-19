import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
export const DEFAULT_CONTEXTS_ROOT = '.shirokuma/contexts';
/** @deprecated #2280: `.shirokuma/docs/` → `.shirokuma/contexts/` リネームに伴い名称変更。新コードは DEFAULT_CONTEXTS_ROOT を使うこと。 */
export const DEFAULT_DOCS_ROOT = DEFAULT_CONTEXTS_ROOT;
/**
 * ドキュメント出力ディレクトリを解決する。
 * 優先順は `src.outputDir` (absolute か projectPath 相対) → `docsRoot/<sourceName>`。
 * `docsRoot` 省略時は `.shirokuma/contexts`（#2280 で `.shirokuma/docs` から rename）。
 */
export function resolveOutputDir(args) {
    if (args.sourceOutputDir) {
        return isAbsolute(args.sourceOutputDir)
            ? args.sourceOutputDir
            : resolve(args.projectPath, args.sourceOutputDir);
    }
    const base = args.docsRoot
        ? resolve(args.projectPath, args.docsRoot)
        : resolve(args.projectPath, DEFAULT_CONTEXTS_ROOT);
    return join(base, args.sourceName);
}
/**
 * docs ルート直下のサブディレクトリから fetch 済みソースを発見する（config フォールバック）。
 * 非表示ディレクトリ（`.` 開始）は除外。
 */
export function discoverFilesystemSources(projectPath, docsRoot) {
    const docsBaseDir = docsRoot
        ? resolve(projectPath, docsRoot)
        : resolve(projectPath, DEFAULT_CONTEXTS_ROOT);
    if (!existsSync(docsBaseDir))
        return [];
    return readdirSync(docsBaseDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => ({ name: e.name }));
}
/**
 * `.md` / `.adoc` ファイルを再帰的に数える。読めないエントリは静かにスキップ。
 */
export function countMarkdownFiles(dir) {
    if (!existsSync(dir))
        return 0;
    try {
        let count = 0;
        for (const entry of readdirSync(dir)) {
            if (entry.startsWith('.'))
                continue;
            const fullPath = join(dir, entry);
            try {
                const st = statSync(fullPath);
                if (st.isDirectory()) {
                    count += countMarkdownFiles(fullPath);
                }
                else if (entry.endsWith('.md') || entry.endsWith('.adoc')) {
                    count++;
                }
            }
            catch {
                // permission error などは無視
            }
        }
        return count;
    }
    catch {
        return 0;
    }
}
/**
 * ディレクトリ内の `.md` / `.txt` ファイルを再帰収集する。search で利用。
 * 読めないエントリ（permission error 等）はスキップする（`countMarkdownFiles` と同じ挙動）。
 */
export function collectMarkdownFiles(dir) {
    if (!existsSync(dir))
        return [];
    const results = [];
    const walk = (current) => {
        try {
            for (const entry of readdirSync(current, { withFileTypes: true })) {
                const fullPath = join(current, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath);
                }
                else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.txt'))) {
                    results.push(fullPath);
                }
            }
        }
        catch {
            // permission error などは無視
        }
    };
    walk(dir);
    return results;
}
/**
 * `.last-fetched` の ISO タイムスタンプを読み込む。
 * `YYYY-MM-DD` へ丸めた形と ISO をそれぞれ返し、片方だけ必要な consumer の詰め替えを省く。
 */
export function readLastFetched(outDir) {
    const file = join(outDir, '.last-fetched');
    if (!existsSync(file))
        return null;
    try {
        const iso = readFileSync(file, 'utf-8').trim();
        const d = new Date(iso);
        if (isNaN(d.getTime()))
            return null;
        return { iso, date: d.toISOString().slice(0, 10) };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=fs-helpers.js.map