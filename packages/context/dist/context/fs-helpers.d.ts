import type { DocsSourceConfig } from './config-types.js';
export declare const DEFAULT_CONTEXTS_ROOT = ".shirokuma/contexts";
/** @deprecated #2280: `.shirokuma/docs/` → `.shirokuma/contexts/` リネームに伴い名称変更。新コードは DEFAULT_CONTEXTS_ROOT を使うこと。 */
export declare const DEFAULT_DOCS_ROOT = ".shirokuma/contexts";
/**
 * ドキュメント出力ディレクトリを解決する。
 * 優先順は `src.outputDir` (absolute か projectPath 相対) → `docsRoot/<sourceName>`。
 * `docsRoot` 省略時は `.shirokuma/contexts`（#2280 で `.shirokuma/docs` から rename）。
 */
export declare function resolveOutputDir(args: {
    projectPath: string;
    sourceName: string;
    sourceOutputDir?: string;
    docsRoot?: string;
}): string;
/**
 * docs ルート直下のサブディレクトリから fetch 済みソースを発見する（config フォールバック）。
 * 非表示ディレクトリ（`.` 開始）は除外。
 */
export declare function discoverFilesystemSources(projectPath: string, docsRoot?: string): DocsSourceConfig[];
/**
 * `.md` / `.adoc` ファイルを再帰的に数える。読めないエントリは静かにスキップ。
 */
export declare function countMarkdownFiles(dir: string): number;
/**
 * ディレクトリ内の `.md` / `.txt` ファイルを再帰収集する。search で利用。
 * 読めないエントリ（permission error 等）はスキップする（`countMarkdownFiles` と同じ挙動）。
 */
export declare function collectMarkdownFiles(dir: string): string[];
/**
 * `.last-fetched` の ISO タイムスタンプを読み込む。
 * `YYYY-MM-DD` へ丸めた形と ISO をそれぞれ返し、片方だけ必要な consumer の詰め替えを省く。
 */
export declare function readLastFetched(outDir: string): {
    iso: string;
    date: string;
} | null;
//# sourceMappingURL=fs-helpers.d.ts.map