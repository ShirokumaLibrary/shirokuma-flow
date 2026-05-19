/**
 * docs search subcommand - ローカルに取得したドキュメントの横断検索
 *
 * キーワードまたは正規表現でローカルファイルを検索し、
 * マッチ結果を table-json または json 形式で出力する。
 */
import type { Logger } from "../../utils/logger.js";
export interface DocsSearchOptions {
    project?: string;
    query: string;
    source?: string;
    regex?: boolean;
    format?: "table-json" | "json";
    context?: number;
    /** 結果件数の上限（未指定時は無制限） */
    limit?: number;
    /**
     * セクションモード: マッチした行を含む見出しセクション（`^#` で区切り）の全体を返す。
     * --limit と組み合わせた場合はセクション単位でカウントする。
     */
    section?: boolean;
    verbose?: boolean;
}
export interface SearchMatch {
    source: string;
    file: string;
    line: number;
    text: string;
    context?: string[];
    /** --section 指定時に付与されるマッチ行を含むセクションの全文 */
    sectionContent?: string;
}
/**
 * ファイル内容を検索してマッチを返す。
 */
export declare function searchFile(filePath: string, pattern: RegExp, contextLines: number): Array<{
    line: number;
    text: string;
    context: string[];
}>;
/**
 * ファイル内容から、指定行番号（1-based）を含む見出しセクションを抽出する。
 * 見出し行（`^#` で始まる行）を区切りとし、マッチ行が含まれるセクションの全文を返す。
 * セクションが見つからない場合はファイル全体を返す。
 */
export declare function extractSection(content: string, lineNumber: number): {
    content: string;
    startLine: number;
};
export declare function cmdSearch(options: DocsSearchOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=search.d.ts.map