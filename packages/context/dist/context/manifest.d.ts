export interface ManifestEntry {
    /** プリセット名 / ソース識別子。 */
    source: string;
    /** パッケージ名（`resolvePackageName` で解決。省略時はソース名フォールバック）。 */
    package: string;
    /** `YYYY-MM-DD` 形式の最終 fetch 日付。 */
    lastFetched: string;
    /** `.md` / `.adoc` ファイル数。 */
    fileCount: number;
}
/**
 * MANIFEST.md のテーブル行をパースする。
 * ヘッダ行（`| ソース | ... |`）とセパレータ行（`|---|---|...`）は
 * `MANIFEST_ROW_PATTERN` の日付カラム（`\d{4}-\d{2}-\d{2}`）に一致しないので自然に除外される。
 */
export declare function parseManifest(content: string): ManifestEntry[];
/**
 * ManifestEntry[] から MANIFEST.md の内容を生成する。ソース名昇順でソート。
 */
export declare function formatManifest(entries: readonly ManifestEntry[]): string;
export interface WriteManifestParams {
    projectPath: string;
    sources: readonly {
        name: string;
        outputDir?: string;
    }[];
    docsRoot?: string;
    /**
     * ソース名からパッケージ名を解決する。未指定時はソース名フォールバック。
     * PRESETS の `packageNames[0]` を返す実装を consumer が注入できる。
     */
    resolvePackageName?: (sourceName: string) => Promise<string | null> | string | null;
}
/**
 * MANIFEST.md を生成/更新する。既存 manifest の config 外エントリは、ディレクトリが
 * 残っていれば保持し、消えていれば evict する（stale エントリを残さない）。
 */
export declare function writeManifest(params: WriteManifestParams): Promise<void>;
/**
 * MANIFEST.md から指定ソースのエントリを削除する。
 * manifest が存在しない / エントリが無い場合は no-op。
 */
export declare function removeManifestEntry(projectPath: string, sourceName: string, docsRoot?: string): void;
//# sourceMappingURL=manifest.d.ts.map