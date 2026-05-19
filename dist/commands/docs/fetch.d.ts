/**
 * docs fetch subcommand - llms.txt からドキュメントを取得
 *
 * scripts/fetch-claude-code-docs.sh の fetch ロジックを Node.js に移植。
 * - llms.txt パース・インクリメンタル DL
 * - 画像処理・SVG→Mermaid 変換（--no-images でスキップ）
 * - linkFormat 自動検出と config への永続化
 *
 * サイト固有のプリセットは presets/ ディレクトリに分離。
 * individual / full-split も各プリセットファイルから呼び出し可能なヘルパーとして export する。
 */
import type { Logger } from "../../utils/logger.js";
import type { DocsSourceConfig } from "../../utils/config.js";
export { extractImageUrls, rewriteImagePaths, convertSvgToMermaid, parseGithubRepoUrl, resolveGithubRepo, fetchGithubTreeEntries, buildGithubRawUrl, } from "./presets/shared.js";
export type { FetchStats, GitHubRepoInfo, GitHubTreeEntry, StrategyModule, StrategyMeta, IndividualStrategyMeta, FullSplitStrategyMeta, } from "./presets/shared.js";
import { type FetchStats, type StrategyMeta, type IndividualStrategyMeta, type FullSplitStrategyMeta } from "./presets/shared.js";
export interface DocsFetchOptions {
    project?: string;
    source?: string;
    force?: boolean;
    dryRun?: boolean;
    images?: boolean;
    verbose?: boolean;
    autoDetect?: boolean;
}
/**
 * プリセット名からメタ情報を非同期に解決する。
 * プリセット名 = プリセットファイル名の規約で `presets/{name}.js` を動的 import する。
 * 見つからない場合は `null` を返す。
 */
export declare function resolvePresetMeta(name: string): Promise<(StrategyMeta & {
    fetchStrategy?: string;
}) | null>;
/**
 * 全プリセット名の一覧を返す（add コマンドのエラーメッセージ用）。
 */
export declare function listPresetNames(): readonly string[];
/**
 * llms.txt の内容からリンク URL を抽出する。
 * Markdown リンク形式 [text](url) および裸の URL 行に対応。
 */
export declare function parseLlmsTxt(content: string, baseUrl?: string): string[];
/**
 * llms.txt の内容から URL とタイトルのペアを抽出する。
 * full-split 時にセクションへ H1 タイトルを付与するために使用。
 * baseUrl が指定された場合、相対パスリンクを絶対 URL に解決する。
 */
export declare function parseLlmsTxtWithTitles(content: string, baseUrl?: string): Array<{
    url: string;
    title: string;
}>;
/**
 * llms.txt を取得してルートディレクトリに保存し、内容を返す。
 * individual / full-split プリセットファイルの execute() から使用する共通ヘルパー。
 *
 * @param sourceName - ソース識別名（ファイル名に使用）
 * @param llmsUrl - llms.txt の URL
 * @param docsRoot - .shirokuma/docs/ などのルートディレクトリ（保存先）
 * @param dryRun - true の場合はファイル保存をスキップ
 * @returns llms.txt の内容
 */
export declare function fetchAndSaveLlmsTxt(sourceName: string, llmsUrl: string, docsRoot: string, dryRun: boolean): Promise<string>;
/**
 * individual プリセットの実行。
 * 各プリセットファイルの execute() から呼び出す共通ロジック。
 */
export declare function fetchIndividual(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger, llmsContent: string, meta: IndividualStrategyMeta): Promise<FetchStats>;
/**
 * full-split プリセットの実行。
 * 各プリセットファイルの execute() から呼び出す共通ロジック。
 */
export declare function fetchFullSplit(src: DocsSourceConfig, outDir: string, options: DocsFetchOptions, stats: FetchStats, logger: Logger, llmsContent: string, meta: FullSplitStrategyMeta): Promise<FetchStats>;
export declare function cmdFetch(options: DocsFetchOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=fetch.d.ts.map