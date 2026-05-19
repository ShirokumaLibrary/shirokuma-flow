import type { DocsSourceConfig } from './config-types.js';
export interface SearchMatch {
    source: string;
    file: string;
    /** 1-based 行番号。 */
    line: number;
    text: string;
    /** `context` 指定時に前後を含めた `line: text` フォーマット行の配列。 */
    context?: string[];
    /** `section: true` 指定時、マッチ行を含む見出しセクションの全文。 */
    sectionContent?: string;
}
export interface SearchParams {
    projectPath: string;
    query: string;
    docsRoot?: string;
    /** 検索対象を特定ソースに絞る（未指定時は filesystem 全探索）。 */
    source?: string;
    /** 正規表現モード（未指定時は substring 検索、大文字小文字区別なし）。 */
    regex?: boolean;
    /** 前後何行を返すか（0 なら context なし）。 */
    context?: number;
    /** 合計マッチ件数の上限。 */
    limit?: number;
    /** マッチ行を含む `^#` 見出しセクションの全文を `sectionContent` に載せる。 */
    section?: boolean;
    /**
     * config で明示されたソース一覧。未指定時は filesystem から discover する。
     * `source` 絞り込みより前に適用される。
     */
    sources?: readonly DocsSourceConfig[];
}
export interface SearchResult {
    matches: SearchMatch[];
    /** 指定 `source` が discover 結果に含まれなかった場合に true。 */
    sourceNotFound?: boolean;
}
/**
 * ローカル fetch 済みドキュメント横断検索（pure data）。
 * `query` を正規表現 / substring 検索でマッチさせ、`SearchMatch[]` を返す。
 *
 * CLI 側は `logger.error` や非 0 exit の判定をここから自由に行える。
 */
export declare function search(params: SearchParams): SearchResult;
/**
 * 1 ファイル内を検索して行ごとのマッチを返す。`context` > 0 で前後行を付ける。
 * 読み込み失敗時は空配列（caller には読めなかった事実だけ伝わる）。
 */
export declare function searchFile(filePath: string, pattern: RegExp, contextLines: number): Array<{
    line: number;
    text: string;
    context: string[];
}>;
/**
 * `lineNumber`（1-based）を含む `^#` 見出しセクションの全文を抽出する。
 * 見出しが無ければファイル全体、最初の見出しより前ならファイル先頭〜最初の見出しまで。
 */
export declare function extractSection(content: string, lineNumber: number): {
    content: string;
    startLine: number;
};
//# sourceMappingURL=search.d.ts.map