/**
 * Bundled plugin utilities for shirokuma-skills-en
 *
 * @description Constants, validators, and helpers for installing/updating
 * the bundled shirokuma-skills-en plugin. Skills and rules are bundled in
 * the plugin/ directory within the shirokuma-docs npm package.
 *
 * @remarks External command dependencies (9 calls via execFileSync):
 * - `claude plugin marketplace list/remove/add` (3): Marketplace registration management.
 *   Claude CLI is the only interface for plugin marketplace operations.
 * - `claude plugin uninstall/install` (3): Plugin install/uninstall to global cache.
 *   Claude CLI is the only interface for plugin cache management.
 * - `claude --version` (1): CLI availability check.
 * - `npm --version` (1): npm availability check for self-update.
 * - `npm install` (1): Self-update of shirokuma-docs CLI package.
 *
 * These external dependencies are intentionally preserved because:
 * 1. Claude CLI operations have no programmatic API alternative
 * 2. npm install for self-update requires the npm CLI
 * 3. Async conversion is deferred to a separate issue to minimize blast radius
 */
/**
 * Plugin name for the bundled skills/rules package
 */
export declare const PLUGIN_NAME = "shirokuma-skills-en";
/**
 * Japanese language plugin name (parallel plugin for i18n)
 */
export declare const PLUGIN_NAME_JA = "shirokuma-skills-ja";
/**
 * Hooks-only plugin name (language-independent safety hooks)
 */
export declare const PLUGIN_NAME_HOOKS = "shirokuma-hooks";
/**
 * Available skills list (matches actual plugin/skills/ directory names)
 */
export declare const AVAILABLE_SKILLS: readonly ["coding-claude-config", "review-issue", "discovering-codebase-rules", "researching-best-practices", "reviewing-claude-config", "plan-issue", "implement-flow", "commit-issue", "open-pr-issue", "create-item-flow", "setting-up-project", "starting-session", "showing-github", "managing-github-items", "project-config-generator", "publishing"];
/**
 * Available rules list
 */
export declare const AVAILABLE_RULES: readonly ["best-practices-first.md", "git-commit-style.md", "output-destinations.md", "skill-authoring.md", "github/branch-workflow.md", "github/discussions-usage.md", "github/pr-review-response.md", "github/project-items.md", "shirokuma-docs/cli-invocation.md", "shirokuma-docs/plugin-cache.md", "shirokuma-docs/shirokuma-annotations.md"];
/**
 * Deploy target directory for rules (relative to project root)
 */
export declare const DEPLOYED_RULES_DIR = ".shirokuma/rules/shirokuma";
/**
 * Gitignore entries managed by shirokuma-docs init
 */
export declare const GITIGNORE_ENTRIES: string[];
/**
 * Result of registering the plugin in Claude Code's global cache
 */
export interface CacheRegistrationResult {
    success: boolean;
    method: "install" | "reinstall" | "skipped";
    message?: string;
}
/**
 * Deploy options for deployRules()
 */
export interface DeployRulesOptions {
    /** Preview mode - report what would change without writing */
    dryRun?: boolean;
    /** Enable verbose logging */
    verbose?: boolean;
    /** Override bundled plugin path (for JA plugin support) */
    bundledPluginPath?: string;
    /** Override deploy target directory (for JA plugin support) */
    targetDir?: string;
    /** 管理外ファイルを削除する（update 時に使用） */
    cleanup?: boolean;
}
/**
 * Result for a single deployed rule
 */
export interface DeployedRuleItem {
    name: string;
    status: "deployed" | "updated" | "unchanged" | "removed" | "error";
    reason?: string;
}
/**
 * Full deploy result
 */
export interface DeployResult {
    deployed: DeployedRuleItem[];
    targetDir: string;
    /** デプロイ対象に含まれないファイル（管理外） */
    unmanagedFiles: string[];
}
/**
 * プラグインキャッシュのベースルートパスを返す
 *
 * テスト環境では `SHIROKUMA_PLUGIN_CACHE_ROOT` を設定することで
 * 実ユーザーの `~/.claude/plugins/cache/` への書き込みを防ぐ。
 * 環境変数が未設定の場合は通常の `~/.claude/plugins/cache` を返す。
 *
 * `NODE_ENV=test` かつ `SHIROKUMA_PLUGIN_CACHE_ROOT` 未設定の場合、
 * 実ユーザーのキャッシュが汚染される可能性があるため初回呼び出し時に警告を出す。
 *
 * @returns プラグインキャッシュのベースルートパス
 */
export declare function getPluginCacheBaseRoot(): string;
/**
 * Get path to a bundled plugin directory by name
 *
 * Resolves the plugin directory relative to this module's location.
 * In development: {repo-root}/plugin/{pluginName}/
 * When installed: {node_modules/shirokuma-docs}/plugin/{pluginName}/
 *
 * @param pluginName - Plugin directory name
 * @returns Absolute path to the bundled plugin directory
 */
export declare function getBundledPluginPathFor(pluginName: string): string;
/**
 * Get path to the bundled plugin directory (EN)
 *
 * @returns Absolute path to the bundled plugin directory
 */
export declare function getBundledPluginPath(): string;
/**
 * Get path to the bundled Japanese plugin directory
 *
 * @returns Absolute path to the bundled Japanese plugin directory
 */
export declare function getBundledPluginPathJa(): string;
/**
 * Get version from package.json
 *
 * @returns Package version string or "unknown"
 */
export declare function getPackageVersion(): string;
/**
 * Get version from the bundled plugin's plugin.json
 *
 * バンドル → グローバルキャッシュ → "unknown" の順でフォールバック (#674)
 *
 * @returns Plugin version string or "unknown"
 */
export declare function getPluginVersion(): string;
/**
 * グローバルキャッシュから直接プラグインバージョンを読み取る
 *
 * `getPluginVersion()` はバンドルプラグインを最優先するため、
 * キャッシュ更新後も古い値を返す場合がある。この関数はバンドル
 * フォールバックをバイパスし、グローバルキャッシュのみ参照する。
 *
 * @param pluginName - プラグイン名
 * @returns バージョン文字列、取得失敗時は undefined
 */
export declare function getPluginVersionFromGlobalCache(pluginName: string): string | undefined;
/**
 * Validate skill name against AVAILABLE_SKILLS list
 *
 * @param skill - Skill name to validate
 * @returns true if skill is in the available list
 */
export declare function isValidSkill(skill: string): skill is typeof AVAILABLE_SKILLS[number];
/**
 * Validate skill name format (prevents path traversal)
 *
 * Accepts: lowercase alphanumeric + hyphens (e.g., "managing-agents", "review-issue")
 * Rejects: dots, slashes, underscores, spaces, uppercase, empty strings
 *
 * @param name - Skill name to validate
 * @returns true if the name is a safe, valid format
 */
export declare function isValidSkillName(name: string): boolean;
/**
 * Get list of rule file paths from the bundled plugin directory
 *
 * Scans plugin/rules/ up to 2 levels deep (root + 1 subdirectory),
 * returning relative paths like "best-practices-first.md",
 * "github/project-items.md", etc.
 *
 * Note: Matches the depth of getInstalledRules(). If deeper nesting
 * is needed in the future, both functions should be updated together.
 *
 * @returns Array of relative rule file paths
 */
export declare function getBundledRuleNames(): string[];
/**
 * Get list of rule file paths from a given rules directory
 *
 * Scans up to 2 levels deep (root + 1 subdirectory).
 *
 * @param rulesDir - Absolute path to rules directory
 * @returns Array of relative rule file paths
 */
export declare function getBundledRuleNamesFrom(rulesDir: string): string[];
/**
 * Get the effective plugin directory for a project
 *
 * Global cache → bundled fallback
 *
 * @param projectPath - Project root path (unused, kept for API compatibility)
 * @returns Absolute path to the effective plugin directory
 */
export declare function getEffectivePluginDir(_projectPath: string): string;
/**
 * Get list of installed skill names from a project
 *
 * Scans the effective plugin directory for installed skills.
 * For self-repo, reads from bundled source; otherwise from .claude/plugins/.
 *
 * @param projectPath - Project root path
 * @returns Array of installed skill names
 */
export declare function getInstalledSkills(projectPath: string): string[];
/**
 * Get list of installed rule names from a project
 *
 * Scans the effective plugin directory for installed rules.
 * For self-repo, reads from bundled source; otherwise from .claude/plugins/.
 *
 * @param projectPath - Project root path
 * @returns Array of installed rule file paths
 */
export declare function getInstalledRules(projectPath: string): string[];
/**
 * .gitignore にエントリを追加する（重複チェック付き）
 *
 * @param projectPath - プロジェクトルートパス
 * @param options - オプション（dryRun, verbose）
 * @returns 追加されたエントリ数
 */
export declare function updateGitignore(projectPath: string, options?: {
    dryRun?: boolean;
    verbose?: boolean;
}): {
    added: string[];
    alreadyPresent: string[];
};
/**
 * Deploy plugin rules to .shirokuma/rules/shirokuma/
 *
 * Copies rule files from the bundled plugin to the target directory.
 * Rules are injected via `!` syntax in SKILL.md, not auto-loaded by Claude Code.
 * The .claude/rules/ directory is not used to avoid double-loading.
 *
 * @param projectPath - Target project root path
 * @param options - Deploy options (dryRun, verbose)
 * @returns Deploy result with per-file status
 */
export declare function deployRules(projectPath: string, options?: DeployRulesOptions): DeployResult;
/**
 * semver 簡易比較関数（外部依存なし）
 *
 * shirokuma-docs の既知バージョン体系に限定対応:
 * major.minor.patch[-prerelease.N]
 *
 * @param a - バージョン文字列
 * @param b - バージョン文字列
 * @returns 負数: a < b、0: a === b、正数: a > b
 */
export declare function compareSemver(a: string, b: string): number;
/**
 * マーケットプレース名（marketplace.json の name フィールドで解決）
 */
export declare const MARKETPLACE_NAME = "shirokuma-library";
/**
 * マーケットプレースリポジトリ
 */
export declare const MARKETPLACE_REPO = "ShirokumaLibrary/shirokuma-plugins";
/**
 * known_marketplaces.json から MARKETPLACE_NAME の installLocation を解決する
 *
 * ファイル読み込み → JSON パース → エントリ取得 → パス存在確認を一括で行う。
 * `getMarketplaceClonePath()` と `refreshMarketplaceClone()` の共通ロジック (#963)。
 *
 * @returns installLocation のパス、見つからない場合は null
 */
export declare function resolveMarketplaceInstallLocation(): string | null;
/**
 * marketplace ローカルクローンを最新に更新する
 *
 * `claude plugin install` は `~/.claude/plugins/marketplaces/` のローカルクローンから
 * プラグインを読み取るため、クローンが古いと旧バージョンがインストールされる (#805)。
 *
 * known_marketplaces.json から installLocation を取得し `git pull --ff-only` を実行する。
 * 失敗時は warn ログを出して続行する（graceful degradation）。
 *
 * @returns true: 更新成功、false: 更新失敗（呼び出し元は続行可能）
 */
export declare function refreshMarketplaceClone(): Promise<boolean>;
/**
 * マーケットプレースが登録済みか確認し、未登録なら追加する
 *
 * `claude plugin marketplace list` で確認し、MARKETPLACE_NAME が
 * 含まれていなければ `claude plugin marketplace add` で登録する。
 *
 * Directory ソース（ローカル参照）が検出された場合は再登録して
 * GitHub ソース（fresh clone）に切り替える (#679)。
 *
 * @returns true: 登録済みまたは登録成功、false: 登録失敗
 */
export declare function ensureMarketplace(): Promise<boolean>;
/**
 * グローバルキャッシュ内のプラグインディレクトリパスを解決する
 *
 * キャッシュパス: ~/.claude/plugins/cache/{marketplace}/{pluginName}/{version}/
 *
 * @param pluginName - プラグイン名
 * @param version - 特定バージョン（省略時は最新を自動検出）
 * @param options - オプション
 * @param options.preferLocal - true のとき local/ ディレクトリが存在すれば最優先で返す
 * @returns キャッシュパス、見つからない場合は null
 */
export declare function getGlobalCachePath(pluginName: string, version?: string, options?: {
    preferLocal?: boolean;
}): string | null;
/**
 * プレリリースチャンネルの優先順位
 *
 * alpha < beta < rc < stable の順。
 * 各チャンネルはそのレベル以上のバージョンを受け入れる。
 */
export type PluginChannel = "stable" | "rc" | "beta" | "alpha";
/**
 * marketplace クローンのローカルパスを取得する
 *
 * known_marketplaces.json から installLocation を読み取る。
 *
 * @returns クローンパス、見つからない場合は null
 */
export declare function getMarketplaceClonePath(): string | null;
/**
 * marketplace クローンの git タグからチャンネルに合致する最新バージョンを解決する
 *
 * @param channel - リリースチャンネル
 * @param clonePath - marketplace クローンのローカルパス
 * @returns 合致する最新バージョンタグ（"v" プレフィックス付き）、見つからない場合は null
 */
export declare function resolveVersionByChannel(channel: PluginChannel, clonePath: string): Promise<string | null>;
/**
 * marketplace クローンを指定タグに一時チェックアウトして関数を実行する
 *
 * try/finally パターンで main ブランチへの復帰を保証する。
 * checkout 失敗時は fn() を実行せずエラーをスローする。
 *
 * @param clonePath - marketplace クローンのローカルパス
 * @param tag - チェックアウトするタグ
 * @param fn - タグチェックアウト中に実行する関数
 */
export declare function withMarketplaceVersion<T>(clonePath: string, tag: string, fn: () => T | Promise<T>): Promise<T>;
/**
 * Plugin identifier for Claude Code's plugin registry
 */
export declare const PLUGIN_REGISTRY_ID = "shirokuma-skills-en@shirokuma-library";
/**
 * Japanese plugin identifier for Claude Code's plugin registry
 */
export declare const PLUGIN_REGISTRY_ID_JA = "shirokuma-skills-ja@shirokuma-library";
/**
 * Hooks plugin identifier for Claude Code's plugin registry
 */
export declare const PLUGIN_REGISTRY_ID_HOOKS = "shirokuma-hooks@shirokuma-library";
/**
 * Optional plugin identifiers (framework-specific, installed on demand)
 */
export declare const OPTIONAL_PLUGIN_IDS: Record<string, {
    en: string;
    ja: string;
}>;
/**
 * Detect which optional plugins are already installed in the global cache
 * or enabled in the project's settings.json.
 * Returns the keys (e.g., ["nextjs", "infra"]) for plugins found.
 */
export declare function detectInstalledOptionalPlugins(projectPath?: string): string[];
/**
 * Register the plugin in Claude Code's global cache
 *
 * Runs `claude plugin install` to copy from .claude/plugins/ to the global
 * cache (~/.claude/plugins/cache/). Claude Code only reads skills from the
 * global cache, not the project-local directory.
 *
 * @param projectPath - Project root path
 * @param options - Registration options
 * @returns Registration result
 */
export declare function registerPluginCache(projectPath: string, options?: {
    reinstall?: boolean;
    registryId?: string;
}): CacheRegistrationResult;
/**
 * Check if the `claude` CLI is available in PATH
 *
 * @returns true if claude CLI is installed and accessible
 */
export declare function isClaudeCliAvailable(): boolean;
/**
 * プロジェクトの .claude/settings.json から language 設定を読み取る
 *
 * @param projectPath - プロジェクトルートパス
 * @returns "english" | "japanese" | null（未設定時）
 */
export declare function getLanguageSetting(projectPath: string): string | null;
/**
 * Remove all deployed rules by deleting the deployed rules directory
 *
 * The directory is fully owned by shirokuma-docs, so the entire
 * directory is removed without per-file checks.
 *
 * @param projectPath - Project root path
 * @param options - Clean options (dryRun, verbose)
 * @returns Array of removed items (for reporting)
 */
export declare function cleanDeployedRules(projectPath: string, options?: {
    dryRun?: boolean;
    verbose?: boolean;
}): DeployedRuleItem[];
/**
 * グローバルキャッシュの古いバージョンディレクトリを削除する (#679)
 *
 * uninstall + install を繰り返すとキャッシュディレクトリが肥大化する。
 * semver ソートで最新 keepCount 個を残し、古いバージョンを削除する。
 *
 * installed_plugins.json は操作しない（Claude Code 管理ファイル）。
 *
 * @param pluginName - プラグイン名
 * @param keepCount - 残すバージョン数（デフォルト: 3）
 * @returns 削除されたバージョンの配列
 */
export declare function cleanupOldCacheVersions(pluginName: string, keepCount?: number): string[];
/**
 * グローバルキャッシュの local/ ディレクトリを削除する (#1841)
 *
 * `plugin-install-local` を使ってローカルビルドをキャッシュに入れた後、
 * `update-skills --sync` でリリース版に切り戻す際に local/ が残存する問題を修正する。
 *
 * local/ が存在しない場合は何もせず false を返す（冪等）。
 *
 * @param pluginName - プラグイン名
 * @returns true: 削除した、false: local/ が存在しなかった
 */
export declare function cleanupLocalCacheDir(pluginName: string): boolean;
/**
 * ローカルプラグインインストールの結果
 */
export interface LocalInstallResult {
    success: boolean;
    pluginName: string;
    cachePath: string;
    message?: string;
}
/**
 * ローカルの plugin/{pluginName}/ をグローバルキャッシュの local/ バージョンにコピーする
 *
 * コピー先: ~/.claude/plugins/cache/{marketplace}/{pluginName}/local/
 * 再インストール時は local/ を事前にクリアして冪等性を保つ。
 *
 * @param pluginName - プラグイン名（例: "shirokuma-skills-ja"）
 * @param sourcePath - コピー元のプラグインディレクトリパス（例: "/path/to/repo/plugin/shirokuma-skills-ja"）
 * @param options - オプション（dryRun）
 * @returns インストール結果
 */
export declare function installLocalPlugin(pluginName: string, sourcePath: string, options?: {
    dryRun?: boolean;
}): LocalInstallResult;
/**
 * ensureSingleLanguagePlugin の結果
 */
export interface SingleLanguageResult {
    /** 逆言語プラグインの uninstall を試行したか */
    attempted: boolean;
    /** 逆言語プラグインの名前（試行した場合） */
    oppositePlugin?: string;
    /** キャッシュディレクトリを削除したか */
    cacheRemoved: boolean;
}
/**
 * CLI 自動更新の結果
 */
export interface CliUpdateResult {
    success: boolean;
    status: "updated" | "upToDate" | "skipped" | "failed";
    oldVersion?: string;
    newVersion?: string;
    message?: string;
}
/**
 * CLI のインストール先ディレクトリを検出する
 *
 * `import.meta.url` からファイルパスを取得し、`/node_modules/` の最初の出現位置を
 * 基に wrapper ディレクトリを特定する。wrapper ディレクトリの `package.json` に
 * `@shirokuma-library/shirokuma-docs` の依存があることを検証する。
 *
 * 開発環境（リポジトリ直接実行）の場合は `null` を返す。
 *
 * @returns wrapper ディレクトリのパス、検出できない場合は null
 */
export declare function getCliInstallDir(): string | null;
/**
 * CLI パッケージを npm install で更新する
 *
 * @param installDir - wrapper ディレクトリのパス
 * @param options - オプション（dryRun）
 * @returns 更新結果
 */
export declare function updateCliPackage(installDir: string, options?: {
    dryRun?: boolean;
}): CliUpdateResult;
/**
 * 言語設定と異なるプラグインを削除し、単一言語のみを保持する (#812)
 *
 * `claude plugin uninstall` で逆言語プラグインの登録を解除し、
 * キャッシュディレクトリも削除する。`claude plugin list` のパースは
 * 行わない（出力フォーマットへの依存を回避）。
 *
 * @param projectPath - プロジェクトルートパス
 * @param languageSetting - 言語設定（"english" | "japanese" | null）
 * @param options - オプション（verbose）
 * @returns 削除結果
 */
export declare function ensureSingleLanguagePlugin(projectPath: string, languageSetting: string | null, options?: {
    verbose?: boolean;
}): SingleLanguageResult;
/**
 * installAllPlugins のオプション
 */
export interface InstallAllPluginsOptions {
    projectPath: string;
    languageSetting: string | null;
    channel?: PluginChannel;
    /** init: false (デフォルト), update: true */
    reinstall?: boolean;
    /** init: false (デフォルト), update: true */
    cleanupOldVersions?: boolean;
    verbose?: boolean;
    /** オプショナルプラグインキー (例: ["nextjs"]) */
    optionalPlugins?: string[];
}
/**
 * 個々のプラグインインストール結果
 */
export interface PluginInstallStatus {
    registryId: string;
    success: boolean;
    message?: string;
}
/**
 * installAllPlugins の戻り値
 */
export interface InstallAllPluginsResult {
    marketplaceOk: boolean;
    plugins: PluginInstallStatus[];
    singleLanguage: SingleLanguageResult;
    deployedRulesCleaned: boolean;
    cleanedVersions: Record<string, string[]>;
    /** local/ ディレクトリを削除したプラグイン名の配列 (#1841) */
    cleanedLocalDirs: string[];
}
/**
 * marketplace 確認→プラグインインストール→逆言語削除→キャッシュクリーンアップを一括実行 (#1043)
 *
 * `init.ts` と `update-skills.ts` の共通プラグインインストールパターンをカプセル化する。
 * 呼び出し元は `isClaudeCliAvailable()` チェックと `dryRun` ガードを担当する。
 *
 * @param options - インストールオプション
 * @returns インストール結果
 */
export declare function installAllPlugins(options: InstallAllPluginsOptions): Promise<InstallAllPluginsResult>;
//# sourceMappingURL=skills-repo.d.ts.map