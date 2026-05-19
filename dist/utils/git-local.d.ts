/**
 * ローカル .git ファイル直接読み取りユーティリティ
 *
 * spawnSync("git", ...) を排除し、.git ディレクトリ内のファイルを
 * 直接読み取ることで同期的に git 情報を取得する。
 * git worktree 環境にも対応。
 */
/**
 * .git/HEAD からブランチ名を取得する。
 *
 * - `ref: refs/heads/{branch}` → ブランチ名を返す
 * - detached HEAD（コミットハッシュ）→ null
 * - worktree の場合は worktree 固有の HEAD を読む
 */
export declare function getCurrentBranch(cwd?: string): string | null;
/**
 * .git/config から指定リモートの URL を取得する。
 *
 * [remote "origin"] セクションの url 行をパースする。
 */
export declare function getGitRemoteUrl(remoteName?: string, cwd?: string): string | null;
/**
 * .git ディレクトリの存在でリポジトリ内か判定する。
 * worktree の .git ファイルも検出する。
 */
export declare function isInsideGitRepo(cwd?: string): boolean;
/**
 * .git/config から全リモート情報を取得する。
 * diagnoseRepoFailure() 用。
 */
export declare function getGitRemotes(cwd?: string): Array<{
    name: string;
    url: string;
}>;
/**
 * ブランチ名から Issue 番号を推論する。
 *
 * - マッチ対象: `^(feat|fix|chore|refactor|docs|perf|test)\/(\d+)(?:-.*)?$`
 * - `epic/` プレフィックスは除外（Integration ブランチ `epic/{N}-slug` の誤マッチ防止）
 * - ホワイトリスト外のプレフィックス（`feature/` 等）も null を返す
 *
 * 受理パターン例:
 * - `feat/2121-foo` → 2121
 * - `fix/123` → 123
 * - `chore/456-abc` → 456
 * - `feat/2121-foo/bar` → 2121（数字の後がハイフンで始まるスラグは `.` にマッチして `/` も含まれうる）
 *
 * 棄却パターン例:
 * - `feat/123/sub` → null（数字の直後が `-` 以外の場合は棄却）
 * - `epic/2121-integration` → null（ホワイトリスト外プレフィックス）
 * - `develop` / `main` → null（プレフィックスなし）
 *
 * @param branchName - ブランチ名
 * @returns Issue 番号、または推論不可な場合は null
 */
export declare function inferIssueFromBranch(branchName: string): number | null;
//# sourceMappingURL=git-local.d.ts.map