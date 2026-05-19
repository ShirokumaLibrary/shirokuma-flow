import type { DocsSourceConfig } from './config-types.js';
export interface SourceStatus {
    name: string;
    url?: string;
    outputDir: string;
    /** `.last-fetched` に記録された ISO 文字列。未 fetch なら null。 */
    lastFetched: string | null;
    /** `.md` / `.adoc` ファイル数（再帰）。 */
    fileCount: number;
}
export interface ListSourcesParams {
    projectPath: string;
    docsRoot?: string;
    /** config で明示されたソース一覧。未指定時は filesystem から discover する。 */
    sources?: readonly DocsSourceConfig[];
}
/**
 * fetch 済みドキュメントソースの状態を列挙する（pure data）。
 * CLI 側で JSON / テーブル整形する（ADR-0012）。
 */
export declare function listSources(params: ListSourcesParams): SourceStatus[];
//# sourceMappingURL=list.d.ts.map