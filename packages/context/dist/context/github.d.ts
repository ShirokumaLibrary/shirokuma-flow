export interface GitHubRepoInfo {
    owner: string;
    repo: string;
}
export interface GitHubTreeEntry {
    path: string;
    type: string;
}
export interface GitHubTreeEntryWithSha extends GitHubTreeEntry {
    sha: string;
}
/**
 * GitHub API 呼び出しのオプション。
 * `token` を渡すと Authorization ヘッダを付けてレート制限を引き上げる
 * （anonymous: 60/h → authenticated: 5000/h）。
 */
export interface GitHubRequestOptions {
    token?: string;
    /** fetch timeout (ms). 既定 30000。 */
    timeoutMs?: number;
}
/**
 * `https://github.com/{owner}/{repo}[.git]` 形式のリポジトリ URL を owner/repo に分解。
 * 他ホストや不完全な URL は null。
 *
 * Note: root の `src/lib/git.ts` に SSH / short form まで含む上位版の
 * `parseGitHubRepo` がある。パッケージ境界を越えられないため本 primitive は
 * HTTPS 限定の縮小版。将来 `@shirokuma-library/git-url` に抽出する余地あり。
 */
export declare function parseGithubRepoUrl(url: string): GitHubRepoInfo | null;
/**
 * `raw.githubusercontent.com` の URL を構築する。
 */
export declare function buildGithubRawUrl(owner: string, repo: string, branch: string, filePath: string): string;
/**
 * Git Tree API で指定ブランチの **全エントリ** を取得する（`recursive=1`）。
 * ENOBUFS になるような巨大リポジトリでは `fetchGithubSubtreeBySha` を使う。
 *
 * ADR-0013 準拠: `gh` CLI には依存せず `fetch()` を直接利用する。認証が必要な
 * 場合（rate limit 回避 / private repo）は `options.token` に GITHUB_TOKEN を渡す。
 */
export declare function fetchGithubTreeEntries(owner: string, repo: string, branch: string, options?: GitHubRequestOptions): Promise<GitHubTreeEntry[]>;
/**
 * Git Tree API で **SHA 指定のサブツリー** を取得する。
 * ルートから recursive すると ENOBUFS / payload too large になるような
 * 大規模リポジトリで、`resolveGithubTreeSha` で得たサブツリー SHA 経由で取る。
 */
export declare function fetchGithubSubtreeBySha(owner: string, repo: string, sha: string, options?: GitHubRequestOptions): Promise<GitHubTreeEntryWithSha[]>;
/**
 * 指定ツリー参照（ブランチ or SHA）の **shallow listing** から `targetPath` エントリの
 * SHA を解決する。サブツリー fetch の前段として使う。
 * 見つからなければ null。
 */
export declare function resolveGithubTreeSha(owner: string, repo: string, treeRef: string, targetPath: string, options?: GitHubRequestOptions): Promise<string | null>;
//# sourceMappingURL=github.d.ts.map