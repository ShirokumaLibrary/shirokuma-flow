/**
 * GitHub utilities for shirokuma-flow
 *
 * Shared utilities for projects, issues, discussions commands.
 * Uses octokit for GraphQL and REST API access.
 */

import { readFileSync } from "node:fs";
import { getOctokit } from "./octokit-client.js";
import { GraphqlResponseError } from "@octokit/graphql";
import { getGitRemoteUrl, isInsideGitRepo, getGitRemotes } from "./git-local.js";

/** Input validation limits */
export const MAX_TITLE_LENGTH = 256;
export const MAX_BODY_LENGTH = 65536; // 64KB

/** Pagination limits */
export const ITEMS_PER_PAGE = 100;
export const FIELDS_PER_PAGE = 20;

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
export type GhResult<T> =
  | { success: true; data: T; graphqlErrors?: GraphQLError[] }
  | { success: false; error: string };

/** Variable value type for GraphQL */
export type GhVariableValue = string | number | boolean | null | string[];

/**
 * Convert GhVariableValue record to octokit-compatible variables.
 * null は除外（octokit は undefined で省略）。
 */
function convertVariables(
  variables: Record<string, GhVariableValue>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(variables)) {
    if (value !== null) {
      result[key] = value;
    }
  }
  return result;
}

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
export async function runGraphQL<T = unknown>(
  query: string,
  variables: Record<string, GhVariableValue>,
  options: { silent?: boolean; headers?: Record<string, string> } = {}
): Promise<GhResult<T>> {
  // Guard: "query" は octokit でもクエリパラメータとして予約されている (#585)
  if ("query" in variables) {
    return {
      success: false,
      error: 'Variable name "query" is reserved. Use a different name (e.g., "searchQuery").',
    };
  }

  const { silent = false } = options;

  try {
    const octokit = getOctokit();
    const convertedVars = convertVariables(variables);

    const data = await octokit.graphql(query, {
      ...convertedVars,
      ...(options.headers ? { headers: options.headers } : {}),
    });

    // ランタイム型ガード: レスポンスが非 null オブジェクトであることを検証
    if (data === null || data === undefined || typeof data !== "object") {
      return { success: false, error: "Unexpected GraphQL response structure" };
    }

    // 後方互換: { data: <response> } でラップ
    return { success: true, data: { data } as unknown as T };
  } catch (error) {
    if (error instanceof GraphqlResponseError) {
      // 部分成功: data と errors が両方ある場合
      if (error.data !== undefined && error.data !== null && typeof error.data === "object") {
        const graphqlErrors: GraphQLError[] = (error.errors ?? []).map((e) => ({
          message: e.message,
          type: (e as Record<string, unknown>).type as string | undefined,
          path: (e as Record<string, unknown>).path as string[] | undefined,
        }));
        return {
          success: true,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: { data: error.data } as unknown as T,
          graphqlErrors,
        };
      }

      // 完全失敗: data なし
      const msg = (error.errors ?? []).map((e) => e.message).filter(Boolean).join("; ") || "Unknown GraphQL error";
      if (!silent) console.error(`GraphQL error: ${msg}`);
      return { success: false, error: `GraphQL error: ${msg}` };
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    if (!silent) console.error(`Error: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

// =============================================================================
// Git remote parsing (no API calls needed)
// =============================================================================

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
export function parseGitRemoteUrl(url: string): { owner: string; name: string } | null {
  // SSH: git@github.com:owner/repo.git
  const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/\s]+?)(?:\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], name: sshMatch[2] };
  }

  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = url.match(/https?:\/\/github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], name: httpsMatch[2] };
  }

  return null;
}

/**
 * .git/config から origin リモート URL を取得する。
 * git-local.ts による直接ファイル読み取り。同期関数。
 */
function getGitRemoteOriginUrl(): string | null {
  return getGitRemoteUrl("origin");
}

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
export function getOwner(): string | null {
  const url = getGitRemoteOriginUrl();
  if (!url) return null;
  return parseGitRemoteUrl(url)?.owner ?? null;
}

/**
 * カレントリポジトリのリポジトリ名を取得する（git remote URL パース）。
 *
 * @returns リポジトリ名。git remote が未設定またはパース失敗時は `null`
 *
 * @example
 * ```typescript
 * const name = getRepoName() // => "shirokuma-flow"
 * ```
 *
 * @category Git Remote
 */
export function getRepoName(): string | null {
  const url = getGitRemoteOriginUrl();
  if (!url) return null;
  return parseGitRemoteUrl(url)?.name ?? null;
}

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
export function getRepoInfo(): { owner: string; name: string } | null {
  const url = getGitRemoteOriginUrl();
  if (!url) return null;
  return parseGitRemoteUrl(url);
}

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
export async function diagnoseRepoFailure(): Promise<{ cause: string; suggestion: string }> {
  // (1) git リポジトリ内かチェック（.git ファイル直接読み取り）
  if (!isInsideGitRepo()) {
    return {
      cause: "Not inside a git repository",
      suggestion: "Run this command from a git repository root, or run: git init",
    };
  }

  // (2) git remote に GitHub URL が含まれるかチェック（.git/config 直接読み取り）
  const remotes = getGitRemotes();

  if (remotes.length === 0) {
    return {
      cause: "No git remote configured",
      suggestion: "Add a GitHub remote: git remote add origin https://github.com/OWNER/REPO.git",
    };
  }

  if (!remotes.some(r => r.url.includes("github.com"))) {
    return {
      cause: "No GitHub remote found (remotes exist but none point to github.com)",
      suggestion: "Add a GitHub remote: git remote add origin https://github.com/OWNER/REPO.git",
    };
  }

  // (3) octokit で認証チェック
  const ghCheck = await checkGitHubAuth();
  if (!ghCheck.success) {
    return {
      cause: "GitHub API is not authenticated",
      suggestion: "Set GITHUB_TOKEN environment variable, or run: gh auth login",
    };
  }

  // (4) フォールバック: 上記すべてパスしたが取得できない場合
  return {
    cause: "Could not resolve repository (multiple remotes or no default set)",
    suggestion: "Use the --owner option to specify the repository owner",
  };
}

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
export function validateTitle(title: string): string | null {
  if (!title || !title.trim()) {
    return "Title cannot be empty";
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return `Title too long (${title.length} > ${MAX_TITLE_LENGTH} chars)`;
  }
  return null;
}

/** コードポイントを大文字16進数文字列に変換する（例: 0xFFFD → "FFFD"） */
const toHex = (cp: number): string => cp.toString(16).toUpperCase().padStart(4, "0");

/**
 * 不正 Unicode の検出結果
 */
interface InvalidUnicodeResult {
  /** 検出されたカテゴリ名 */
  category: string;
  /** 最初に検出したコードポイント（16進数大文字、例: "FFFD"） */
  codePoint: string;
  /** 最初に検出した位置（0-based インデックス） */
  position: number;
}

/**
 * 本文に不正な Unicode が含まれているか検出する。
 *
 * 検出対象:
 * - 代替文字: U+FFFD
 * - 孤立サロゲート: U+D800–U+DFFF
 * - 非文字: U+FDD0–U+FDEF, U+xFFFE, U+xFFFF（x = 0–10）
 * - 不正制御文字: U+0000–U+0008, U+000B, U+000E–U+001F（タブ U+0009, 改行 U+000A, CR U+000D は許可）
 *
 * @param body - 検証する文字列
 * @returns 不正 Unicode が見つかった場合は結果オブジェクト、見つからない場合は `null`
 */
function detectInvalidUnicode(body: string): InvalidUnicodeResult | null {
  for (let i = 0; i < body.length; i++) {
    const cp = body.codePointAt(i);
    if (cp === undefined) continue;

    // 代替文字: U+FFFD
    if (cp === 0xfffd) {
      return { category: "代替文字", codePoint: toHex(cp), position: i };
    }

    // 孤立サロゲート: U+D800–U+DFFF
    // JavaScript 文字列は UTF-16 であり、サロゲートペア外の孤立サロゲートはコードポイントとして直接現れる
    if (cp >= 0xd800 && cp <= 0xdfff) {
      return { category: "孤立サロゲート", codePoint: toHex(cp), position: i };
    }

    // 非文字: U+FDD0–U+FDEF
    if (cp >= 0xfdd0 && cp <= 0xfdef) {
      return { category: "非文字", codePoint: toHex(cp), position: i };
    }

    // 非文字: U+xFFFE, U+xFFFF（x = 0–10）
    // cp & 0xFFFF が 0xFFFE または 0xFFFF かつ U+10FFFF 以内
    const low16 = cp & 0xffff;
    if ((low16 === 0xfffe || low16 === 0xffff) && cp <= 0x10ffff) {
      return { category: "非文字", codePoint: toHex(cp), position: i };
    }

    // 不正制御文字: U+0000–U+0008, U+000B, U+000E–U+001F
    // （許可: U+0009 タブ, U+000A 改行, U+000D CR）
    if (
      (cp >= 0x0000 && cp <= 0x0008) ||
      cp === 0x000b ||
      (cp >= 0x000e && cp <= 0x001f)
    ) {
      return { category: "不正制御文字", codePoint: toHex(cp), position: i };
    }

    // サロゲートペアを構成する場合は次の char を読み飛ばす（codePointAt は自動でペアを処理するが、
    // for ループのインデックスが 1 つしか進まないため Supplementary Plane の文字を正しく処理する）
    if (cp > 0xffff) {
      i++; // サロゲートペア（2 つの char unit）の 2 つ目をスキップ
    }
  }

  return null;
}

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
export function validateBody(body: string | undefined): string | null {
  if (!body) return null;
  if (body.length > MAX_BODY_LENGTH) {
    return `Body too long (${body.length} > ${MAX_BODY_LENGTH} chars)`;
  }
  const invalid = detectInvalidUnicode(body);
  if (invalid) {
    return `本文に不正な Unicode が含まれています: ${invalid.category} (U+${invalid.codePoint} at position ${invalid.position})`;
  }
  return null;
}

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
export function readBodyFile(source: string): string {
  if (source === "-") {
    if (process.stdin.isTTY) {
      throw new Error(
        'stdin is a TTY (no piped input). Use: echo "body" | shirokuma-flow ... --body-file -'
      );
    }
    return readFileSync(0, "utf-8");
  }
  return readFileSync(source, "utf-8");
}

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
export function isIssueNumber(value: string): boolean {
  const clean = value.replace(/^#/, "");
  return /^\d+$/.test(clean);
}

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
export function parseIssueNumber(value: string): number {
  return parseInt(value.replace(/^#/, ""), 10);
}

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
export async function checkGitHubAuth(): Promise<GhResult<{ authenticated: boolean; user: string }>> {
  try {
    const octokit = getOctokit();
    const { data } = await octokit.rest.users.getAuthenticated();

    return {
      success: true,
      data: {
        authenticated: true,
        user: data.login,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMsg.includes("401")
        ? "Not authenticated. Set GITHUB_TOKEN, or run: gh auth login"
        : errorMsg,
    };
  }
}
