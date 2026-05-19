/**
 * docs manifest - MANIFEST.md の生成・更新・エントリ削除
 *
 * `docs fetch` 完了後に `.shirokuma/docs/MANIFEST.md` を自動生成し、
 * Claude Code が docs の存在を自然に認識できるようにする。
 * `docs remove` 時は該当エントリを manifest から削除する。
 */
export interface ManifestEntry {
    /** ソース名（プリセット名） */
    source: string;
    /** パッケージ名（プリセット meta の packageNames[0] またはソース名） */
    package: string;
    /** 最終 fetch 日時（YYYY-MM-DD 形式） */
    lastFetched: string;
    /** .md ファイル数 */
    fileCount: number;
}
/** MANIFEST.md のテーブル行をパースして ManifestEntry 配列を返す */
export declare function parseManifest(content: string): ManifestEntry[];
/** ManifestEntry 配列から MANIFEST.md の内容を生成する */
export declare function formatManifest(entries: ManifestEntry[]): string;
/**
 * MANIFEST.md を生成/更新する。
 * fetch 済みの全ソースから manifest エントリを構築し、既存の manifest とマージする。
 *
 * @param projectPath - プロジェクトルートパス
 * @param sources - ソース一覧（name と outputDir のみ使用）
 * @param docsOutputDir - config の docs.outputDir（デフォルト: ".shirokuma/docs"）
 * @param resolvePackageName - ソース名からパッケージ名を解決するコールバック（省略時はソース名をそのまま使用）
 */
export declare function writeManifest(projectPath: string, sources: {
    name: string;
    outputDir?: string;
}[], docsOutputDir?: string, resolvePackageName?: (name: string) => Promise<string | null>): Promise<void>;
/**
 * MANIFEST.md から指定ソースのエントリを削除する。
 *
 * @param projectPath - プロジェクトルートパス
 * @param sourceName - 削除するソース名
 * @param docsOutputDir - config の docs.outputDir（デフォルト: ".shirokuma/docs"）
 */
export declare function removeManifestEntry(projectPath: string, sourceName: string, docsOutputDir?: string): void;
//# sourceMappingURL=manifest.d.ts.map