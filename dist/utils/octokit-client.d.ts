/**
 * Octokit クライアントのシングルトン管理。
 *
 * 認証フォールバックチェーン:
 * 1. 環境変数 GH_TOKEN（gh CLI 互換、最優先）
 * 2. 環境変数 GITHUB_TOKEN
 * 3. ~/.config/gh/hosts.yml の oauth_token（gh auth login --insecure-storage 使用時）
 */
import { Octokit } from "@octokit/rest";
/** 外部公開用の型（Octokit + paginate + REST endpoints） */
export type OctokitInstance = InstanceType<typeof Octokit>;
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
export declare function resolveAuthToken(): string | null;
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
export declare function getOctokit(): OctokitInstance;
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
export declare function resetOctokit(): void;
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
export declare function setOctokit(instance: OctokitInstance): void;
//# sourceMappingURL=octokit-client.d.ts.map