/**
 * docs fetch プリセットの共通ユーティリティ
 *
 * 各プリセットファイルが共有するファイル取得・画像処理・GitHub API アクセスを提供する。
 */
import type { Logger } from "../../../utils/logger.js";
export interface FetchStats {
    downloaded: number;
    skipped: number;
    failed: number;
    imagesDownloaded: number;
    imagesSkipped: number;
    imagesFailed: number;
    svgConverted: number;
    svgKept: number;
}
/**
 * プリセットファイルが export するプリセットメタ情報。
 * `resolvePresetMeta()` が動的 import でこれを取得し、
 * `fetch.ts` の INTERNAL_PRESET_META では定義できない
 * GitHub 系プリセットの設定情報を自己完結させる。
 */
export interface StrategyMeta {
    /** プリセットの fetch 元 URL（llms.txt URL または GitHub リポジトリ URL） */
    url: string;
    /** npm パッケージ名一覧（docs detect 用） */
    packageNames?: string[];
    /** デフォルトブランチ（GitHub プリセット用） */
    branch?: string;
    /** ドキュメントパス（GitHub プリセット用）。複数指定可 */
    repoPath?: string | string[];
}
/**
 * individual プリセットのメタ情報。
 * llms.txt の各リンクを個別に取得するプリセット設定。
 */
export interface IndividualStrategyMeta extends StrategyMeta {
    fetchStrategy: "individual";
    /** リンク形式（md: Markdown リンクそのまま, clean: .md 付与） */
    linkFormat?: "md" | "clean";
    /** fetch 後に各ファイルの先頭から除去するパターン（正規表現文字列） */
    stripHeaderPattern?: string;
    /** fetch 後に各ファイルから除去する行パターン（正規表現文字列） */
    stripLinePattern?: string;
}
/**
 * full-split プリセットのメタ情報。
 * llms-full.txt を分割パターンでファイルに分割するプリセット設定。
 */
export interface FullSplitStrategyMeta extends StrategyMeta {
    fetchStrategy: "full-split";
    /** llms-full.txt の URL */
    fullUrl: string;
    /** リンク形式（md: Markdown リンクそのまま, clean: .md 付与） */
    linkFormat?: "md" | "clean";
    /** 分割パターン（正規表現文字列） */
    splitPattern: string;
    /** セクションフォーマッタ名 */
    sectionFormatter?: "metadata-to-frontmatter" | "passthrough";
    /** fetch 後に各ファイルから除去する行パターン（正規表現文字列） */
    stripLinePattern?: string;
}
/** サイト固有プリセットモジュールが export すべきインターフェース */
export interface StrategyModule {
    execute: (src: import("../../../utils/config.js").DocsSourceConfig, outDir: string, options: {
        force?: boolean;
        dryRun?: boolean;
        images?: boolean;
        verbose?: boolean;
    }, stats: FetchStats, logger: Logger) => Promise<FetchStats>;
}
export declare function createEmptyStats(): FetchStats;
/**
 * Markdown ファイルを取得する。
 * インクリメンタル: 既存ファイルより古ければスキップ。
 * 戻り値: "downloaded" | "skipped" | "failed"
 */
export declare function fetchMarkdown(url: string, outFile: string, force: boolean): Promise<"downloaded" | "skipped" | "failed">;
/**
 * .last-fetched タイムスタンプを記録する。
 */
export declare function writeLastFetched(outDir: string): void;
/**
 * Markdown ファイル内の画像 URL を抽出する。
 */
export declare function extractImageUrls(content: string): string[];
/**
 * Markdown ファイル内の画像 URL を相対パスに書き換える。
 */
export declare function rewriteImagePaths(content: string, rewrites: Map<string, string>): string;
/**
 * SVG ファイルを claude CLI で Mermaid に変換する。
 */
export declare function convertSvgToMermaid(svgFile: string): boolean;
/**
 * 出力ディレクトリ内の Markdown ファイルに含まれる画像を DL・パス書き換えする。
 */
export declare function processImages(outDir: string, force: boolean, stats: FetchStats, logger: Logger, sourceName: string): Promise<void>;
export interface GitHubRepoInfo {
    owner: string;
    repo: string;
}
/**
 * GitHub リポジトリ URL から owner/repo を解析する。
 * `https://github.com/{owner}/{repo}` 形式のみ受け付ける。
 */
export declare function parseGithubRepoUrl(url: string): GitHubRepoInfo | null;
/**
 * GitHub プリセットの共通エントリーガード。
 * URL を解析し、失敗時はエラーログを出して null を返す。
 */
export declare function resolveGithubRepo(src: import("../../../utils/config.js").DocsSourceConfig, strategyName: string, logger: Logger): GitHubRepoInfo | null;
export interface GitHubTreeEntry {
    path: string;
    type: string;
}
/**
 * GitHub Git Tree API でリポジトリのファイル一覧を取得する。
 * gh CLI の認証を利用する。
 */
export declare function fetchGithubTreeEntries(owner: string, repo: string, branch: string): GitHubTreeEntry[];
export interface GitHubTreeEntryWithSha extends GitHubTreeEntry {
    sha: string;
}
/**
 * GitHub Git Tree API で SHA を指定してサブツリーのファイル一覧を取得する。
 * ルートから `recursive=1` すると ENOBUFS になるような大規模リポジトリ向けに、
 * SHA で絞り込んだサブツリーに対して再帰取得を行う。
 * gh CLI の認証を利用する。
 */
export declare function fetchGithubSubtreeBySha(owner: string, repo: string, sha: string): GitHubTreeEntryWithSha[];
/**
 * GitHub Git Tree API でディレクトリの SHA を解決する。
 * 指定パスのエントリを shallow tree から検索して SHA を返す。
 * 見つからない場合は null を返す。
 */
export declare function resolveGithubTreeSha(owner: string, repo: string, treeRef: string, targetPath: string): string | null;
/**
 * raw.githubusercontent.com の URL を構築する。
 */
export declare function buildGithubRawUrl(owner: string, repo: string, branch: string, filePath: string): string;
//# sourceMappingURL=shared.d.ts.map