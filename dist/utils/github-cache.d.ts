/**
 * GitHub データのローカルキャッシュユーティリティ (#1768, #1874)
 *
 * GitHub データ（Issue、PR、Discussion およびそのコメント）を
 * `.shirokuma/github/` にローカルファイルとして保存する。
 *
 * ファイル構造:
 * ```
 * .shirokuma/github/{org}/{repo}/
 * ├── issues/{number}/body.md            # Issue 本体
 * ├── issues/{number}/{databaseId}.md    # Issue コメント
 * ├── pulls/{number}/body.md             # PR 本体
 * ├── pulls/{number}/{databaseId}.md     # PR コメント
 * ├── discussions/{number}/body.md       # Discussion 本体
 * ├── discussions/{number}/{databaseId}.md  # Discussion コメント
 * └── open-issues.md                     # オープン Issue/PR のインデックス
 * ```
 *
 * Discussion のスレッド返信は、トップレベルコメントと同じ `{databaseId}.md` 形式で保存され、
 * frontmatter の `reply_to` フィールドに返信先コメントの `databaseId` を保持する。
 *
 * frontmatter + Markdown body 形式。
 * frontmatter にメタデータ（number, type, updated_at, cached_at）を保持。
 */
/** キャッシュディレクトリのデフォルトパス */
export declare const GITHUB_CACHE_DIR = ".shirokuma/github";
/** type → ディレクトリ名マッピング */
export declare const TYPE_DIR_MAP: {
    readonly issue: "issues";
    readonly pull_request: "pulls";
    readonly discussion: "discussions";
};
/** キャッシュエントリのメタデータ */
export interface CacheMetadata {
    /** アイテム番号 (Issue / PR / Discussion 共通) */
    number: number;
    /** アイテム種別 */
    type: "issue" | "pull_request" | "discussion";
    /** GitHub 上の最終更新日時 (ISO 8601) */
    updated_at?: string;
    /** キャッシュ書き込み日時 (ISO 8601) */
    cached_at: string;
    /** タイトル */
    title?: string;
    /** Projects Status フィールド */
    status?: string;
    /** Projects Priority フィールド */
    priority?: string;
    /** Projects Size フィールド */
    size?: string;
    /** ラベル一覧 */
    labels?: string[];
    /** 担当者一覧 */
    assignees?: string[];
    /** Issue Type 名（例: "Bug", "Feature"） */
    issue_type?: string;
    /** Issue 状態: open, closed */
    state?: string;
    /** クローズ理由: COMPLETED, NOT_PLANNED */
    state_reason?: string;
    /** 親 Issue 番号 */
    parent?: number;
    /** サブ Issue の要約 */
    subIssuesSummary?: {
        total: number;
        completed: number;
        percentCompleted: number;
    };
}
/** キャッシュ読み込み結果 */
export interface CacheEntry {
    /** frontmatter メタデータ */
    metadata: CacheMetadata;
    /** Markdown 本文 */
    body: string;
    /** frontmatter + body の全テキスト */
    raw: string;
}
/** コメントキャッシュのメタデータ */
export interface CommentCacheMetadata {
    /** 親アイテム番号 */
    number: number;
    /** コメント databaseId */
    database_id: number;
    /** 返信先コメント databaseId（Discussion スレッド返信の場合） */
    reply_to?: number;
    /** GitHub 上の最終更新日時 (ISO 8601) */
    updated_at?: string;
    /** キャッシュ書き込み日時 (ISO 8601) */
    cached_at: string;
}
/** コメントキャッシュ読み込み結果 */
export interface CommentCacheEntry {
    /** frontmatter メタデータ */
    metadata: CommentCacheMetadata;
    /** Markdown 本文 */
    body: string;
    /** frontmatter + body の全テキスト */
    raw: string;
}
/** open-issues.md インデックスエントリ */
export interface OpenIssueEntry {
    number: number;
    type: "issue" | "pull_request";
    title: string;
    status?: string;
    priority?: string;
    size?: string;
}
/**
 * アイテム本体のキャッシュファイルパスを返す。
 * 新構造: `{baseDir}/{org}/{repo}/{typeDir}/{number}/body.md`
 *
 * @param number - Issue / PR / Discussion 番号
 * @param type - アイテム種別
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ（デフォルト: `.shirokuma/github`）
 * @returns ファイルパス
 */
export declare function getCachePath(number: number, type: "issue" | "pull_request" | "discussion", org: string, repo: string, baseDir?: string): string;
/**
 * コメントのキャッシュファイルパスを返す。
 * 新構造: `{baseDir}/{org}/{repo}/{typeDir}/{number}/{databaseId}.md`
 *
 * @param number - 親アイテム番号
 * @param databaseId - コメントの databaseId
 * @param type - 親アイテム種別
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ（デフォルト: `.shirokuma/github`）
 * @returns ファイルパス
 */
export declare function getCommentCachePath(number: number, databaseId: number, type: "issue" | "pull_request" | "discussion", org: string, repo: string, baseDir?: string): string;
/**
 * open-issues.md インデックスファイルのパスを返す。
 *
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 */
export declare function getOpenIssuesIndexPath(org: string, repo: string, baseDir?: string): string;
/**
 * アイテム本体のキャッシュを書き込む。
 *
 * frontmatter に `cached_at`（現在時刻）を含む。
 *
 * @param number - Issue / PR / Discussion 番号
 * @param metadata - 書き込むメタデータ（`cached_at` は自動設定）
 * @param body - Markdown 本文（省略可）
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 */
export declare function writeCache(number: number, metadata: Omit<CacheMetadata, "cached_at">, body: string | undefined, org: string, repo: string, baseDir?: string): void;
/**
 * アイテム本体のキャッシュを読み込む。
 *
 * @param number - Issue / PR / Discussion 番号
 * @param type - アイテム種別
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 * @returns キャッシュエントリ、または存在しない場合は `null`
 */
export declare function readCache(number: number, type: "issue" | "pull_request" | "discussion", org: string, repo: string, baseDir?: string): CacheEntry | null;
/**
 * コメントのキャッシュを書き込む。
 *
 * @param number - 親アイテム番号
 * @param databaseId - コメントの databaseId
 * @param metadata - 書き込むメタデータ（`cached_at` は自動設定）
 * @param body - Markdown 本文（省略可）
 * @param type - 親アイテム種別
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 */
export declare function writeCommentCache(number: number, databaseId: number, metadata: Omit<CommentCacheMetadata, "cached_at">, body: string | undefined, type: "issue" | "pull_request" | "discussion", org: string, repo: string, baseDir?: string): void;
/**
 * コメントのキャッシュを読み込む。
 *
 * @param number - 親アイテム番号
 * @param databaseId - コメントの databaseId
 * @param type - 親アイテム種別
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 * @returns コメントキャッシュエントリ、または存在しない場合は `null`
 */
export declare function readCommentCache(number: number, databaseId: number, type: "issue" | "pull_request" | "discussion", org: string, repo: string, baseDir?: string): CommentCacheEntry | null;
/** type が不明な場合に issue → pull_request → discussion の順でキャッシュを検索する */
export declare function probeReadCache(number: number, org: string, repo: string, baseDir?: string): CacheEntry | null;
/**
 * open-issues.md インデックスを書き込む。
 * `items pull` / `items close` / `items reopen` の後に呼び出す。
 *
 * @param entries - オープンな Issue / PR のエントリ一覧
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 */
export declare function writeOpenIssuesIndex(entries: OpenIssueEntry[], org: string, repo: string, baseDir?: string): void;
/**
 * open-issues.md インデックスを読み込む。
 *
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 * @returns エントリ一覧、またはファイルが存在しない場合は空配列
 */
export declare function readOpenIssuesIndex(org: string, repo: string, baseDir?: string): OpenIssueEntry[];
/**
 * 単一エントリを open-issues.md インデックスに追加または更新する（インクリメンタル）。
 * 既存インデックスを読み込み、該当エントリだけを差し替えて書き戻す。
 */
export declare function upsertOpenIssuesEntry(entry: OpenIssueEntry, org: string, repo: string, baseDir?: string): void;
/**
 * 指定番号のエントリを open-issues.md インデックスから削除する（インクリメンタル）。
 */
export declare function removeOpenIssuesEntry(number: number, org: string, repo: string, baseDir?: string): void;
/**
 * open-issues.md インデックスをフルリビルドする。
 * マイグレーション等で使用。通常のコマンドでは upsertOpenIssuesEntry / removeOpenIssuesEntry を使う。
 *
 * @param org - GitHub 組織名
 * @param repo - リポジトリ名
 * @param baseDir - キャッシュのベースディレクトリ
 */
export declare function rebuildOpenIssuesIndex(org: string, repo: string, baseDir?: string): void;
//# sourceMappingURL=github-cache.d.ts.map