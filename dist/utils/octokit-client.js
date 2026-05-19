/**
 * Octokit クライアントのシングルトン管理。
 *
 * 認証フォールバックチェーン:
 * 1. 環境変数 GH_TOKEN（gh CLI 互換、最優先）
 * 2. 環境変数 GITHUB_TOKEN
 * 3. ~/.config/gh/hosts.yml の oauth_token（gh auth login --insecure-storage 使用時）
 */
import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { parse as parseYaml } from "yaml";
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
const ThrottledOctokit = Octokit.plugin(throttling, retry);
/** シングルトンインスタンス */
let octokitInstance = null;
/**
 * gh CLI の設定ディレクトリを解決する。
 * 優先順位: GH_CONFIG_DIR > XDG_CONFIG_HOME/gh > ~/.config/gh
 */
function resolveGhConfigDir() {
    if (process.env.GH_CONFIG_DIR)
        return process.env.GH_CONFIG_DIR;
    if (process.env.XDG_CONFIG_HOME)
        return join(process.env.XDG_CONFIG_HOME, "gh");
    return join(homedir(), ".config", "gh");
}
/**
 * ~/.config/gh/hosts.yml から github.com の oauth_token を読み取る。
 * ファイル不在・パースエラー時は null を返す（例外を投げない）。
 *
 * hosts.yml のフォーマット（gh auth login --insecure-storage 使用時）:
 * ```yaml
 * github.com:
 *   oauth_token: gho_xxxxxxxxxxxx
 *   user: username
 *   git_protocol: https
 * ```
 */
function readGhHostsToken() {
    try {
        const hostsPath = join(resolveGhConfigDir(), "hosts.yml");
        if (!existsSync(hostsPath))
            return null;
        const content = readFileSync(hostsPath, "utf-8");
        const parsed = parseYaml(content);
        if (!parsed || typeof parsed !== "object")
            return null;
        const githubEntry = parsed["github.com"];
        if (!githubEntry || typeof githubEntry !== "object")
            return null;
        const token = githubEntry["oauth_token"];
        if (typeof token === "string" && token.length > 0)
            return token;
        return null;
    }
    catch {
        return null;
    }
}
/**
 * 認証トークンを取得する。
 * 優先順位: GH_TOKEN > GITHUB_TOKEN > hosts.yml（gh CLI 互換順序）
 *
 * @returns 認証トークン文字列。いずれのソースからも取得できない場合は `null`
 *
 * @example
 * ```typescript
 * const token = resolveAuthToken()
 * if (!token) throw new Error("No auth token found")
 * ```
 *
 * @category Authentication
 */
export function resolveAuthToken() {
    if (process.env.GH_TOKEN)
        return process.env.GH_TOKEN;
    if (process.env.GITHUB_TOKEN)
        return process.env.GITHUB_TOKEN;
    return readGhHostsToken();
}
/**
 * Octokit シングルトンインスタンスを取得する。
 * 初回呼び出し時にインスタンスを生成し、以降はキャッシュを返す。
 * throttling（レートリミット自動リトライ）と retry プラグインを含む。
 *
 * @returns Octokit インスタンス（throttling + retry プラグイン付き）
 * @throws {Error} 認証トークンが取得できない場合
 *
 * @example
 * ```typescript
 * const octokit = getOctokit()
 * const { data } = await octokit.rest.repos.get({ owner, repo })
 * ```
 *
 * @category Authentication
 */
export function getOctokit() {
    if (octokitInstance)
        return octokitInstance;
    const token = resolveAuthToken();
    if (!token) {
        throw new Error("GitHub authentication token not found. " +
            "Set GH_TOKEN or GITHUB_TOKEN environment variable, " +
            "or run: gh auth login --insecure-storage");
    }
    octokitInstance = new ThrottledOctokit({
        auth: token,
        throttle: {
            onRateLimit: (retryAfter, options, _octokit, retryCount) => {
                const method = options.method ?? "UNKNOWN";
                const url = options.url ?? "UNKNOWN";
                console.warn(`Rate limit hit for ${method} ${url}. Retry after ${retryAfter}s (attempt ${retryCount + 1})`);
                return retryCount < 2;
            },
            onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
                const method = options.method ?? "UNKNOWN";
                const url = options.url ?? "UNKNOWN";
                console.warn(`Secondary rate limit hit for ${method} ${url}. Retry after ${retryAfter}s`);
                return retryCount < 1;
            },
        },
        retry: {
            doNotRetry: [429],
        },
    });
    return octokitInstance;
}
/**
 * シングルトンインスタンスをリセットする（テスト用）。
 * 次回 `getOctokit()` 呼び出し時に新しいインスタンスが生成される。
 *
 * @example
 * ```typescript
 * afterEach(() => resetOctokit())
 * ```
 *
 * @category Testing
 */
export function resetOctokit() {
    octokitInstance = null;
}
/**
 * テスト用: 任意の Octokit インスタンスを注入する。
 * 注入後は `getOctokit()` がこのインスタンスを返す。
 *
 * @param instance - 注入する Octokit インスタンス
 *
 * @example
 * ```typescript
 * const mock = new Octokit() as OctokitInstance
 * setOctokit(mock)
 * ```
 *
 * @category Testing
 */
export function setOctokit(instance) {
    octokitInstance = instance;
}
//# sourceMappingURL=octokit-client.js.map