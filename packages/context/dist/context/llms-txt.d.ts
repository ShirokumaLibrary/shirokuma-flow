export interface LlmsTxtEntry {
    url: string;
    /** `[title](url)` 形式のみ title が入る。裸 URL 行は空文字列。 */
    title: string;
}
/**
 * llms.txt の内容からリンク URL だけを抽出する。相対パスは `baseUrl` 起点で
 * 解決される。`parseLlmsTxtWithTitles` の薄いラッパー。
 */
export declare function parseLlmsTxt(content: string, baseUrl?: string): string[];
/**
 * llms.txt の内容から URL とタイトルのペアを抽出する。
 * full-split 時にセクションへ H1 タイトルを付与するために使用する。
 * `baseUrl` が指定された場合、相対パスリンク (`/foo/bar`) を絶対 URL に解決する。
 *
 * 抽出順:
 *   1. `[title](https?://...)` — 絶対 URL の Markdown リンク
 *   2. `[title](/path)` — baseUrl の origin で絶対化
 *   3. 行頭が `http://` / `https://` の裸 URL 行（title は空）
 * 同じ URL は先勝ち（重複は除去）。
 */
export declare function parseLlmsTxtWithTitles(content: string, baseUrl?: string): LlmsTxtEntry[];
/**
 * llms.txt から URL→タイトルの Map を構築する。`full-split` セクションに
 * H1 タイトルを付与するための補助構造。タイトルが空のエントリは無視される。
 */
export declare function buildTitleMap(llmsContent: string): Map<string, string>;
//# sourceMappingURL=llms-txt.d.ts.map