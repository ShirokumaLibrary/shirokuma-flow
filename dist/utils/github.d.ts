/**
 * GitHub utilities for shirokuma-docs
 *
 * Shared utilities for projects, issues, discussions commands.
 * Uses octokit for GraphQL and REST API access.
 */
/** Input validation limits */
export declare const MAX_TITLE_LENGTH = 256;
export declare const MAX_BODY_LENGTH = 65536;
/** Pagination limits */
export declare const ITEMS_PER_PAGE = 100;
export declare const FIELDS_PER_PAGE = 20;
/**
 * GraphQL-level error from GitHub API response.
 * Present in partial or full failure responses alongside or instead of data.
 */
export interface GraphQLError {
    message: string;
    type?: string;
    path?: string[];
}
/**
 * Result type for GitHub operations.
 * graphqlErrors is set when the GraphQL response contains errors alongside data (partial success).
 */
export type GhResult<T> = {
    success: true;
    data: T;
    graphqlErrors?: GraphQLError[];
} | {
    success: false;
    error: string;
};
/** Variable value type for GraphQL */
export type GhVariableValue = string | number | boolean | null | string[];
/**
 * Run a GraphQL query via octokit.graphql()
 *
 * 後方互換ラッパー: octokit は { data: ... } ラッパーを自動除去して返すが、
 * 既存の呼び出し元は result.data.data.xxx でアクセスしているため、
 * { data: ... } で再ラップして互換性を維持する。
 *
 * @param query - GraphQL クエリ文字列
 * @param variables - クエリ変数。`"query"` キーは予約済みのため使用不可
 * @param options - オプション設定
 * @param options.silent - `true` でエラー時の console.error を抑制する
 * @param options.headers - 追加リクエストヘッダー
 * @returns 成功時は `{ success: true, data, graphqlErrors? }`、失敗時は `{ success: false, error }`
 *
 * @example
 * ```typescript
 * const result = await runGraphQL<QueryResult>(
 *   `query($owner: String!) { organization(login: $owner) { id } }`,
 *   { owner: "my-org" }
 * )
 * if (result.success) console.log(result.data)
 * ```
 *
 * @category GitHub API
 */
export declare function runGraphQL<T = unknown>(query: string, variables: Record<string, GhVariableValue>, options?: {
    silent?: boolean;
    headers?: Record<string, string>;
}): Promise<GhResult<T>>;
/**
 * git remote の origin URL から owner/repo を抽出（SSH/HTTPS 両対応）。
 * API 呼び出し不要で高速。認証前でも動作する。
 *
 * @param url - git remote URL（例: `git@github.com:owner/repo.git`, `https://github.com/owner/repo`）
 * @returns パース成功時は `{ owner, name }`、GitHub 以外の URL やパース失敗時は `null`
 *
 * @example
 * ```typescript
 * parseGitRemoteUrl("git@github.com:octocat/hello.git")
 * // => { owner: "octocat", name: "hello" }
 * ```
 *
 * @category Git Remote
 */
export declare function parseGitRemoteUrl(url: string): {
    owner: string;
    name: string;
} | null;
/**
 * カレントリポジトリの owner を取得する（git remote URL パース）。
 *
 * @returns owner 名。git remote が未設定またはパース失敗時は `null`
 *
 * @example
 * ```typescript
 * const owner = getOwner() // => "octocat"
 * ```
 *
 * @category Git Remote
 */
export declare function getOwner(): string | null;
/**
 * カレントリポジトリのリポジトリ名を取得する（git remote URL パース）。
 *
 * @returns リポジトリ名。git remote が未設定またはパース失敗時は `null`
 *
 * @example
 * ```typescript
 * const name = getRepoName() // => "shirokuma-docs"
 * ```
 *
 * @category Git Remote
 */
export declare function getRepoName(): string | null;
/**
 * カレントリポジトリの owner とリポジトリ名をまとめて取得する（git remote URL パース）。
 *
 * @returns `{ owner, name }` オブジェクト。git remote が未設定またはパース失敗時は `null`
 *
 * @example
 * ```typescript
 * const info = getRepoInfo() // => { owner: "octocat", name: "hello" }
 * ```
 *
 * @category Git Remote
 */
export declare function getRepoInfo(): {
    owner: string;
    name: string;
} | null;
/**
 * リポジトリ情報取得の失敗原因を診断する。
 * getOwner() / getRepoName() / getRepoInfo() が null を返した後に呼び出す。
 * コストの低いチェックから順に実行し、最初にヒットした原因を返す。
 *
 * @returns `{ cause, suggestion }` — 検出された原因と推奨アクション
 *
 * @example
 * ```typescript
 * const info = getRepoInfo()
 * if (!info) {
 *   const { cause, suggestion } = await diagnoseRepoFailure()
 *   console.error(cause, suggestion)
 * }
 * ```
 *
 * @category Git Remote
 */
export declare function diagnoseRepoFailure(): Promise<{
    cause: string;
    suggestion: string;
}>;
/**
 * タイトル入力をバリデーションする。
 *
 * @param title - 検証するタイトル文字列
 * @returns エラーメッセージ。バリデーション通過時は `null`
 *
 * @example
 * ```typescript
 * const err = validateTitle("") // => "Title cannot be empty"
 * const ok = validateTitle("Fix bug") // => null
 * ```
 *
 * @category Validation
 */
export declare function validateTitle(title: string): string | null;
/**
 * 本文入力をバリデーションする。
 *
 * 以下を検証する:
 * 1. 本文長（MAX_BODY_LENGTH 超過）
 * 2. 不正 Unicode（代替文字・孤立サロゲート・非文字・不正制御文字）
 *
 * @param body - 検証する本文文字列。`undefined` の場合はバリデーション通過
 * @returns エラーメッセージ。バリデーション通過時は `null`
 *
 * @example
 * ```typescript
 * const err = validateBody("x".repeat(70000)) // => "Body too long ..."
 * const ok = validateBody("Hello") // => null
 * const inv = validateBody("\uFFFD") // => "本文に不正な Unicode が含まれています: 代替文字 (U+FFFD at position 0)"
 * ```
 *
 * @category Validation
 */
export declare function validateBody(body: string | undefined): string | null;
/**
 * ファイルパスまたは stdin から本文を読み込む。
 * `--body-file -` の場合は stdin、それ以外はファイルパスとして読み取る。
 *
 * @param source - `"-"` で stdin から読み取り、それ以外はファイルパスとして扱う
 * @returns 読み込んだ本文の文字列
 * @throws {Error} ファイルが存在しない、読み取り権限がない場合、またはパイプなしの TTY で stdin を指定した場合
 *
 * @example
 * ```typescript
 * const body = readBodyFile("/tmp/body.md")
 * const stdin = readBodyFile("-")
 * ```
 *
 * @category Input
 */
export declare function readBodyFile(source: string): string;
/**
 * 値が Issue 番号のパターンに一致するか判定する（整数または `#` 付き整数）。
 *
 * @param value - 判定する文字列（例: `"123"`, `"#123"`）
 * @returns Issue 番号パターンに一致する場合 `true`
 *
 * @example
 * ```typescript
 * isIssueNumber("#42")  // => true
 * isIssueNumber("abc")  // => false
 * ```
 *
 * @category Issue
 */
export declare function isIssueNumber(value: string): boolean;
/**
 * 文字列から Issue 番号を整数にパースする（`#123` と `123` の両形式に対応）。
 *
 * @param value - パースする文字列（例: `"#123"`, `"123"`）
 * @returns パースされた Issue 番号（整数）。非数値の場合は `NaN`
 *
 * @example
 * ```typescript
 * parseIssueNumber("#42") // => 42
 * parseIssueNumber("123") // => 123
 * ```
 *
 * @category Issue
 */
export declare function parseIssueNumber(value: string): number;
/**
 * GitHub API のアクセス可否と認証状態を確認する。
 * octokit REST API を使用（GITHUB_TOKEN または gh auth token フォールバック）。
 *
 * @returns 成功時は `{ success: true, data: { authenticated: true, user } }`、
 *   認証失敗時は `{ success: false, error }` を返す
 *
 * @example
 * ```typescript
 * const auth = await checkGitHubAuth()
 * if (auth.success) console.log(`Authenticated as ${auth.data.user}`)
 * ```
 *
 * @category GitHub API
 */
export declare function checkGitHubAuth(): Promise<GhResult<{
    authenticated: boolean;
    user: string;
}>>;
//# sourceMappingURL=github.d.ts.map