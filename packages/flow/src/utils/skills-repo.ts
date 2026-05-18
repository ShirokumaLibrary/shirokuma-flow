/**
 * Bundled plugin utilities for shirokuma-skills-en
 *
 * @description Constants, validators, and helpers for installing/updating
 * the bundled shirokuma-skills-en plugin. Skills and rules are bundled in
 * the plugin/ directory within the shirokuma-flow npm package.
 *
 * @remarks External command dependencies (9 calls via execFileSync):
 * - `claude plugin marketplace list/remove/add` (3): Marketplace registration management.
 *   Claude CLI is the only interface for plugin marketplace operations.
 * - `claude plugin uninstall/install` (3): Plugin install/uninstall to global cache.
 *   Claude CLI is the only interface for plugin cache management.
 * - `claude --version` (1): CLI availability check.
 * - `npm --version` (1): npm availability check for self-update.
 * - `npm install` (1): Self-update of shirokuma-flow CLI package.
 *
 * These external dependencies are intentionally preserved because:
 * 1. Claude CLI operations have no programmatic API alternative
 * 2. npm install for self-update requires the npm CLI
 * 3. Async conversion is deferred to a separate issue to minimize blast radius
 */

import { join, dirname } from "node:path";
import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { simpleGit } from "simple-git";
import { createLogger } from "./logger.js";
import { t } from "./i18n.js";

// ========================================
// Constants
// ========================================

/**
 * Plugin name for the bundled skills/rules package
 */
export const PLUGIN_NAME = "shirokuma-skills-en";

/**
 * Japanese language plugin name (parallel plugin for i18n)
 */
export const PLUGIN_NAME_JA = "shirokuma-skills-ja";

/**
 * Hooks-only plugin name (language-independent safety hooks)
 */
export const PLUGIN_NAME_HOOKS = "shirokuma-hooks";

/**
 * Available skills list (matches actual plugin/skills/ directory names)
 */
export const AVAILABLE_SKILLS = [
  // Config skills (Claude Code configuration authoring)
  "coding-claude-config",
  // Development skills
  "review-issue",
  "discovering-codebase-rules",
  // Subagent skills (formerly agents, merged in #182)
  "researching-best-practices",
  "reviewing-claude-config",
  // Workflow skills
  "plan-issue",
  "implement-flow",
  "commit-issue",
  "open-pr-issue",
  "create-item-flow",
  // GitHub integration skills
  "setting-up-project",
  "starting-session",
  "showing-github",
  "managing-github-items",
  "project-config-generator",
  // Release management
  "publishing",
] as const;

/**
 * Available rules list
 */
export const AVAILABLE_RULES = [
  "best-practices-first.md",
  "git-commit-style.md",
  "output-destinations.md",
  "skill-authoring.md",
  "github/branch-workflow.md",
  "github/discussions-usage.md",
  "github/pr-review-response.md",
  "github/project-items.md",
  "shirokuma-flow/cli-invocation.md",
  "shirokuma-flow/plugin-cache.md",
  "shirokuma-flow/shirokuma-annotations.md",
] as const;

/**
 * Deploy target directory for rules (relative to project root)
 */
export const DEPLOYED_RULES_DIR = ".shirokuma/rules/shirokuma";

/**
 * Gitignore entries managed by shirokuma-flow init
 */
export const GITIGNORE_ENTRIES = [
  ".claude/plans/",
  ".shirokuma/contexts/",
];

// ========================================
// Types
// ========================================

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

// ========================================
// Path Resolution
// ========================================

let warnedTestCacheUnset = false;

/**
 * プラグインキャッシュのベースルートパスを返す
 *
 * テスト環境では `SHIROKUMA_PLUGIN_CACHE_ROOT` を設定することで
 * 実ユーザーの `~/.claude/plugins/cache/` への書き込みを防ぐ。
 * 環境変数が未設定の場合は通常の `~/.claude/plugins/cache` を返す。
 *
 * テスト時の振る舞いは 2 段階:
 *   - `NODE_ENV=test` かつ `SHIROKUMA_PLUGIN_CACHE_ROOT` 未設定: 初回 console.warn
 *     （後方互換のための現行挙動）
 *   - 上記に加えて `SHIROKUMA_PLUGIN_CACHE_STRICT=1`: 即座に Error を throw
 *     （#2197: 新規テストの env 設定漏れを CI で確実に検出するための opt-in）
 *
 * 実 HOME に書き込む統合テスト（`skills-repo-cache.test.ts` /
 * `skills-repo-single-lang.test.ts` 等）は STRICT を設定しないことで
 * 警告のみに留める。
 *
 * @returns プラグインキャッシュのベースルートパス
 * @throws SHIROKUMA_PLUGIN_CACHE_STRICT=1 で SHIROKUMA_PLUGIN_CACHE_ROOT 未設定の場合
 */
export function getPluginCacheBaseRoot(): string {
  if (process.env.SHIROKUMA_PLUGIN_CACHE_ROOT) {
    return process.env.SHIROKUMA_PLUGIN_CACHE_ROOT;
  }
  if (
    process.env.NODE_ENV === "test" &&
    process.env.SHIROKUMA_PLUGIN_CACHE_STRICT === "1"
  ) {
    throw new Error(
      "[shirokuma-flow] SHIROKUMA_PLUGIN_CACHE_STRICT=1 ですが SHIROKUMA_PLUGIN_CACHE_ROOT が未設定です。" +
        " テスト用 tmpdir を SHIROKUMA_PLUGIN_CACHE_ROOT に設定してください" +
        "（例: process.env.SHIROKUMA_PLUGIN_CACHE_ROOT = mkdtempSync(join(tmpdir(), \"shirokuma-test-\"))）。",
    );
  }
  if (process.env.NODE_ENV === "test" && !warnedTestCacheUnset) {
    warnedTestCacheUnset = true;
    console.warn(
      `[shirokuma-flow] 警告: NODE_ENV=test ですが SHIROKUMA_PLUGIN_CACHE_ROOT が未設定です。実ユーザーのキャッシュ (~/.claude/plugins/cache/) への書き込み/削除が発生します。`,
    );
  }
  return join(homedir(), ".claude", "plugins", "cache");
}

/**
 * Get path to a bundled plugin directory by name
 *
 * モジュールの位置を基準にプラグインディレクトリを解決する。
 * - 開発時 (pnpm workspace): {repo-root}/plugin/{pluginName}/（pnpm-workspace.yaml で判定）
 * - dev-deploy (~/.local/share/...): {packageRoot}/plugin/{pluginName}/（switch-cli.sh が事前にコピー）
 * - npm インストール後: 同梱していないため存在しないパスを返す。プラグインは
 *   Claude プラグインキャッシュ経由で利用するのが正規ルートで、本関数の戻り値は
 *   `getGlobalCachePath()` がキャッシュミスした場合のフォールバック用途のみ。
 *   呼び出し側は `existsSync` で存在を確認して使用すること。
 *
 * @param pluginName - プラグインディレクトリ名
 * @returns バンドルプラグインディレクトリへの絶対パス（存在しない場合あり）
 */
export function getBundledPluginPathFor(pluginName: string): string {
  const thisFile = fileURLToPath(import.meta.url);
  const packageRoot = join(dirname(thisFile), "..", "..");

  // 開発時はワークスペースルートの plugin/ を直接参照する。
  // pnpm-workspace.yaml の存在で workspace モードを識別する。
  const workspaceRoot = join(packageRoot, "..", "..");
  const workspacePluginPath = join(workspaceRoot, "plugin", pluginName);
  if (
    existsSync(join(workspaceRoot, "pnpm-workspace.yaml")) &&
    existsSync(workspacePluginPath)
  ) {
    return workspacePluginPath;
  }

  return join(packageRoot, "plugin", pluginName);
}

/**
 * Get path to the bundled plugin directory (EN)
 *
 * @returns Absolute path to the bundled plugin directory
 */
export function getBundledPluginPath(): string {
  return getBundledPluginPathFor(PLUGIN_NAME);
}

/**
 * Get path to the bundled Japanese plugin directory
 *
 * @returns Absolute path to the bundled Japanese plugin directory
 */
export function getBundledPluginPathJa(): string {
  return getBundledPluginPathFor(PLUGIN_NAME_JA);
}

/**
 * Get version from package.json
 *
 * @returns Package version string or "unknown"
 */
export function getPackageVersion(): string {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const packageRoot = join(dirname(thisFile), "..", "..");
    const packageJsonPath = join(packageRoot, "package.json");
    const content = readFileSync(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Get version from the bundled plugin's plugin.json
 *
 * バンドル → グローバルキャッシュ → "unknown" の順でフォールバック (#674)
 *
 * @returns Plugin version string or "unknown"
 */
export function getPluginVersion(): string {
  // バンドルプラグインから取得
  try {
    const pluginJsonPath = join(getBundledPluginPath(), ".claude-plugin", "plugin.json");
    const content = readFileSync(pluginJsonPath, "utf-8");
    const pluginJson = JSON.parse(content) as { version?: string };
    if (pluginJson.version) return pluginJson.version;
  } catch {
    // バンドルなし — キャッシュにフォールバック
  }

  // グローバルキャッシュから取得（外部プロジェクト向け）
  for (const pluginName of [PLUGIN_NAME, PLUGIN_NAME_JA]) {
    const cachePath = getGlobalCachePath(pluginName);
    if (cachePath) {
      try {
        const cachePluginJsonPath = join(cachePath, ".claude-plugin", "plugin.json");
        const content = readFileSync(cachePluginJsonPath, "utf-8");
        const pluginJson = JSON.parse(content) as { version?: string };
        if (pluginJson.version) return pluginJson.version;
      } catch {
        // キャッシュ読み取り失敗 — 続行
      }
    }
  }

  return "unknown";
}

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
export function getPluginVersionFromGlobalCache(pluginName: string): string | undefined {
  const cachePath = getGlobalCachePath(pluginName);
  if (!cachePath) return undefined;

  try {
    const pluginJsonPath = join(cachePath, ".claude-plugin", "plugin.json");
    const content = readFileSync(pluginJsonPath, "utf-8");
    const pluginJson = JSON.parse(content) as { version?: string };
    return pluginJson.version ?? undefined;
  } catch {
    return undefined;
  }
}

// ========================================
// Validation
// ========================================

/**
 * Validate skill name against AVAILABLE_SKILLS list
 *
 * @param skill - Skill name to validate
 * @returns true if skill is in the available list
 */
export function isValidSkill(skill: string): skill is typeof AVAILABLE_SKILLS[number] {
  return (AVAILABLE_SKILLS as readonly string[]).includes(skill);
}

/**
 * Validate skill name format (prevents path traversal)
 *
 * Accepts: lowercase alphanumeric + hyphens (e.g., "managing-agents", "review-issue")
 * Rejects: dots, slashes, underscores, spaces, uppercase, empty strings
 *
 * @param name - Skill name to validate
 * @returns true if the name is a safe, valid format
 */
export function isValidSkillName(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name);
}

// ========================================
// Bundled Rules Discovery
// ========================================

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
export function getBundledRuleNames(): string[] {
  return getBundledRuleNamesFrom(join(getBundledPluginPath(), "rules"));
}

/**
 * Get list of rule file paths from a given rules directory
 *
 * Scans up to 2 levels deep (root + 1 subdirectory).
 *
 * @param rulesDir - Absolute path to rules directory
 * @returns Array of relative rule file paths
 */
export function getBundledRuleNamesFrom(rulesDir: string): string[] {
  if (!existsSync(rulesDir)) {
    return [];
  }

  const rules: string[] = [];
  const entries = readdirSync(rulesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      rules.push(entry.name);
    } else if (entry.isDirectory()) {
      const subDir = join(rulesDir, entry.name);
      const subEntries = readdirSync(subDir, { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (subEntry.isFile() && subEntry.name.endsWith(".md")) {
          rules.push(`${entry.name}/${subEntry.name}`);
        }
      }
    }
  }

  return rules.sort();
}

// ========================================
// Effective Plugin Directory
// ========================================

/**
 * Get the effective plugin directory for a project
 *
 * Global cache → bundled fallback
 *
 * @param projectPath - Project root path (unused, kept for API compatibility)
 * @returns Absolute path to the effective plugin directory
 */
export function getEffectivePluginDir(_projectPath: string): string {
  // Claude CLI 無効時はキャッシュが未インストール/古い可能性があるためバンドル版を使用
  if (process.env.SHIROKUMA_NO_CLAUDE_CLI) {
    return getBundledPluginPath();
  }
  // キャッシュ → bundled フォールバック
  return getGlobalCachePath(PLUGIN_NAME) ?? getBundledPluginPath();
}

// ========================================
// Installed Skills/Rules Discovery
// ========================================

/**
 * Get list of installed skill names from a project
 *
 * Scans the effective plugin directory for installed skills.
 * For self-repo, reads from bundled source; otherwise from .claude/plugins/.
 *
 * @param projectPath - Project root path
 * @returns Array of installed skill names
 */
export function getInstalledSkills(projectPath: string): string[] {
  const skillsDir = join(getEffectivePluginDir(projectPath), "skills");
  if (!existsSync(skillsDir)) {
    return [];
  }

  return readdirSync(skillsDir).filter(name => {
    const fullPath = join(skillsDir, name);
    return statSync(fullPath).isDirectory() && isValidSkillName(name);
  });
}

/**
 * Get list of installed rule names from a project
 *
 * Scans the effective plugin directory for installed rules.
 * For self-repo, reads from bundled source; otherwise from .claude/plugins/.
 *
 * @param projectPath - Project root path
 * @returns Array of installed rule file paths
 */
export function getInstalledRules(projectPath: string): string[] {
  const rulesDir = join(getEffectivePluginDir(projectPath), "rules");
  if (!existsSync(rulesDir)) {
    return [];
  }

  const rules: string[] = [];
  const entries = readdirSync(rulesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      rules.push(entry.name);
    } else if (entry.isDirectory()) {
      // Scan subdirectories (e.g., github/, nextjs/)
      const subDir = join(rulesDir, entry.name);
      const subEntries = readdirSync(subDir, { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (subEntry.isFile() && subEntry.name.endsWith(".md")) {
          rules.push(`${entry.name}/${subEntry.name}`);
        }
      }
    }
  }

  return rules;
}

// ========================================
// Gitignore Management
// ========================================

/**
 * .gitignore にエントリを追加する（重複チェック付き）
 *
 * @param projectPath - プロジェクトルートパス
 * @param options - オプション（dryRun, verbose）
 * @returns 追加されたエントリ数
 */
export function updateGitignore(
  projectPath: string,
  options: { dryRun?: boolean; verbose?: boolean } = {},
): { added: string[]; alreadyPresent: string[] } {
  const logger = createLogger(options.verbose ?? false);
  const gitignorePath = join(projectPath, ".gitignore");
  const added: string[] = [];
  const alreadyPresent: string[] = [];

  // 既存の .gitignore を読み込む（なければ空）
  let content = "";
  if (existsSync(gitignorePath)) {
    content = readFileSync(gitignorePath, "utf-8");
  }

  // 各行をパースして既存エントリを収集
  const existingEntries = new Set(
    content.split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#")),
  );

  // 追加が必要なエントリを判定
  const toAdd: string[] = [];
  for (const entry of GITIGNORE_ENTRIES) {
    if (existingEntries.has(entry)) {
      alreadyPresent.push(entry);
    } else {
      toAdd.push(entry);
    }
  }

  if (toAdd.length === 0) {
    logger.info(t("commands.skillRepo.gitignoreAllExist"));
    return { added, alreadyPresent };
  }

  // セクションコメント付きで追加
  const section = [
    "",
    "# shirokuma-flow (managed by shirokuma-flow init)",
    ...toAdd,
    "",
  ].join("\n");

  const newContent = content.endsWith("\n") ? content + section : content + "\n" + section;

  if (!options.dryRun) {
    writeFileSync(gitignorePath, newContent, "utf-8");
  }

  for (const entry of toAdd) {
    added.push(entry);
    logger.debug(`  + ${entry}`);
  }

  return { added, alreadyPresent };
}


// ========================================
// Rule Deployment
// ========================================

/**
 * ディレクトリツリーを再帰的に走査し、空ディレクトリを削除する
 */
function removeEmptyDirs(dir: string): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDir = join(dir, entry.name);
      removeEmptyDirs(subDir);
      // サブディレクトリが空になったら削除
      if (readdirSync(subDir).length === 0) {
        rmSync(subDir, { recursive: true, force: true });
      }
    }
  }
}

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
export function deployRules(
  projectPath: string,
  options: DeployRulesOptions = {},
): DeployResult {
  const logger = createLogger(options.verbose ?? false);
  const targetDir = options.targetDir ?? join(projectPath, DEPLOYED_RULES_DIR);
  const results: DeployedRuleItem[] = [];

  // バンドルプラグインから .shirokuma/rules/shirokuma/ にデプロイ
  const pluginPath = options.bundledPluginPath ?? getBundledPluginPath();
  const bundledRulesDir = join(pluginPath, "rules");
  const ruleNames = getBundledRuleNamesFrom(bundledRulesDir);

  if (!existsSync(bundledRulesDir)) {
    logger.warn("Bundled rules directory not found");
    return { deployed: results, targetDir, unmanagedFiles: [] };
  }

  // Ensure target directory exists once before processing files
  if (!options.dryRun) {
    mkdirSync(targetDir, { recursive: true });
  }

  for (const ruleName of ruleNames) {
    const srcPath = join(bundledRulesDir, ruleName);
    const destPath = join(targetDir, ruleName);

    try {
      const sourceContent = readFileSync(srcPath, "utf-8");
      const isNew = !existsSync(destPath);

      // Check if content is identical (for reporting)
      if (!isNew) {
        const existingContent = readFileSync(destPath, "utf-8");
        if (existingContent === sourceContent) {
          results.push({ name: ruleName, status: "unchanged" });
          continue;
        }
      }

      // Deploy or overwrite
      if (!options.dryRun) {
        if (ruleName.includes("/")) {
          mkdirSync(dirname(destPath), { recursive: true });
        }
        writeFileSync(destPath, sourceContent, "utf-8");
      }
      results.push({ name: ruleName, status: isNew ? "deployed" : "updated" });
      logger.debug(`  ${isNew ? "+" : "↑"} ${ruleName} (${isNew ? "deployed" : "updated"})`);
    } catch (error) {
      results.push({
        name: ruleName,
        status: "error",
        reason: error instanceof Error ? error.message : String(error),
      });
      logger.warn(`  ✗ ${ruleName} (error: ${error instanceof Error ? error.message : String(error)})`);
    }
  }

  // 管理外ファイル検出（targetDir にあるが bundled にないファイル）
  const unmanagedFiles: string[] = [];
  if (existsSync(targetDir)) {
    const scanForUnmanaged = (dir: string, prefix: string): void => {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (!ruleNames.includes(relativePath)) {
            unmanagedFiles.push(relativePath);
          }
        } else if (entry.isDirectory()) {
          scanForUnmanaged(join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
        }
      }
    };
    scanForUnmanaged(targetDir, "");
  }

  if (unmanagedFiles.length > 0) {
    if (options.cleanup && !options.dryRun) {
      for (const file of unmanagedFiles) {
        const filePath = join(targetDir, file);
        rmSync(filePath, { force: true });
        results.push({ name: file, status: "removed" });
        logger.info(`  - ${file} (removed)`);
      }
      // 空ディレクトリを削除
      removeEmptyDirs(targetDir);
    } else {
      for (const file of unmanagedFiles) {
        logger.warn(`  ? ${file} (管理外)`);
      }
      if (options.cleanup && options.dryRun) {
        logger.info(`[dry-run] ${unmanagedFiles.length}件の管理外ファイルを削除予定`);
      }
    }
  }

  return { deployed: results, targetDir, unmanagedFiles };
}

// ========================================
// Semver Utilities
// ========================================

/**
 * semver 簡易比較関数（外部依存なし）
 *
 * shirokuma-flow の既知バージョン体系に限定対応:
 * major.minor.patch[-prerelease.N]
 *
 * @param a - バージョン文字列
 * @param b - バージョン文字列
 * @returns 負数: a < b、0: a === b、正数: a > b
 */
export function compareSemver(a: string, b: string): number {
  const parse = (v: string) => {
    const [core, ...preParts] = v.split("-");
    const pre = preParts.length > 0 ? preParts.join("-") : null;
    const [rawMajor, rawMinor, rawPatch] = (core ?? "").split(".").map(Number);
    return {
      major: Number.isNaN(rawMajor) ? 0 : (rawMajor ?? 0),
      minor: Number.isNaN(rawMinor) ? 0 : (rawMinor ?? 0),
      patch: Number.isNaN(rawPatch) ? 0 : (rawPatch ?? 0),
      pre,
    };
  };

  const pa = parse(a);
  const pb = parse(b);

  // major.minor.patch を比較
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;

  // prerelease: リリース版 > プレリリース版
  if (!pa.pre && !pb.pre) return 0;
  if (!pa.pre) return 1;
  if (!pb.pre) return -1;

  // 両方 prerelease: セグメント比較
  const aSegs = pa.pre.split(".");
  const bSegs = pb.pre.split(".");

  for (let i = 0; i < Math.max(aSegs.length, bSegs.length); i++) {
    const aS = aSegs[i];
    const bS = bSegs[i];
    if (aS === undefined) return -1;
    if (bS === undefined) return 1;

    const aNum = Number(aS);
    const bNum = Number(bS);

    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      if (aS < bS) return -1;
      if (aS > bS) return 1;
    }
  }

  return 0;
}

// ========================================
// Marketplace Management
// ========================================

/**
 * マーケットプレース名（marketplace.json の name フィールドで解決）
 */
export const MARKETPLACE_NAME = "shirokuma-library";

/**
 * マーケットプレースリポジトリ
 */
export const MARKETPLACE_REPO = "ShirokumaLibrary/shirokuma-plugins";

/**
 * known_marketplaces.json から MARKETPLACE_NAME の installLocation を解決する
 *
 * ファイル読み込み → JSON パース → エントリ取得 → パス存在確認を一括で行う。
 * `getMarketplaceClonePath()` と `refreshMarketplaceClone()` の共通ロジック (#963)。
 *
 * @returns installLocation のパス、見つからない場合は null
 */
export function resolveMarketplaceInstallLocation(): string | null {
  const knownPath = join(homedir(), ".claude", "plugins", "known_marketplaces.json");
  if (!existsSync(knownPath)) return null;

  try {
    const content = readFileSync(knownPath, "utf-8");
    const known = JSON.parse(content) as Record<string, { installLocation?: string }>;
    const entry = known[MARKETPLACE_NAME];
    if (!entry?.installLocation) return null;
    if (!existsSync(entry.installLocation)) return null;
    return entry.installLocation;
  } catch {
    return null;
  }
}

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
export async function refreshMarketplaceClone(): Promise<boolean> {
  const logger = createLogger(false);
  const installLocation = resolveMarketplaceInstallLocation();
  if (!installLocation) return false;

  try {
    const git = simpleGit(installLocation);
    // タグを確実に取得（チャンネル解決に必要 #961）
    await git.fetch(["--tags"]);
    await git.pull(["--ff-only"]);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`marketplace clone の更新に失敗しました: ${message}`);
    logger.warn(`手動更新: cd ${installLocation} && git pull origin main`);
    return false;
  }
}

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
export async function ensureMarketplace(): Promise<boolean> {
  let needsReRegister = false;

  try {
    const output = execFileSync(
      "claude",
      ["plugin", "marketplace", "list"],
      { encoding: "utf-8", timeout: 15000, stdio: "pipe" },
    );
    if (output.includes(MARKETPLACE_NAME)) {
      // Directory ソースの検出: キャッシュが陳腐化する原因 (#679)
      // marketplace list の各行を解析し、該当エントリのソースを確認
      const lines = output.split("\n");
      for (const line of lines) {
        if (line.includes(MARKETPLACE_NAME) && line.toLowerCase().includes("directory")) {
          needsReRegister = true;
          break;
        }
      }
      if (!needsReRegister) {
        // ローカルクローンを最新に更新してから返す (#805)
        await refreshMarketplaceClone();
        return true;
      }
    }
  } catch {
    // CLI エラー: 登録を試みる
  }

  // Directory ソースの場合は remove してから再登録
  if (needsReRegister) {
    try {
      execFileSync(
        "claude",
        ["plugin", "marketplace", "remove", MARKETPLACE_NAME],
        { encoding: "utf-8", timeout: 15000, stdio: "pipe" },
      );
    } catch {
      // remove 失敗は無視して add を試みる
    }
  }

  try {
    execFileSync(
      "claude",
      ["plugin", "marketplace", "add", MARKETPLACE_REPO],
      { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
    );
    return true;
  } catch {
    return false;
  }
}

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
export function getGlobalCachePath(
  pluginName: string,
  version?: string,
  options?: { preferLocal?: boolean },
): string | null {
  const cacheBase = join(getPluginCacheBaseRoot(), MARKETPLACE_NAME, pluginName);
  if (!existsSync(cacheBase)) return null;

  if (version) {
    const versionDir = join(cacheBase, version);
    return existsSync(versionDir) ? versionDir : null;
  }

  // preferLocal: local/ ディレクトリが存在すれば semver より優先する (#1411)
  if (options?.preferLocal) {
    const localDir = join(cacheBase, "local");
    if (existsSync(localDir)) {
      return localDir;
    }
  }

  // version 未指定: ディレクトリをスキャンし最新を返す（semver ソート #679）
  // "local" ディレクトリは semver として扱わないため除外する
  // TOCTOU 防御: existsSync と readdirSync の間にディレクトリが削除される可能性 (#632)
  try {
    const versions = readdirSync(cacheBase)
      .filter(name => {
        if (name === "local") return false; // local/ は semver ではない
        try { return statSync(join(cacheBase, name)).isDirectory(); }
        catch { return false; }
      })
      .sort((a, b) => compareSemver(b, a));
    return versions.length > 0 ? join(cacheBase, versions[0]) : null;
  } catch {
    return null;
  }
}

// ========================================
// Channel-Based Version Resolution (#961)
// ========================================

/**
 * プレリリースチャンネルの優先順位
 *
 * alpha < beta < rc < stable の順。
 * 各チャンネルはそのレベル以上のバージョンを受け入れる。
 */
export type PluginChannel = "stable" | "rc" | "beta" | "alpha";

/**
 * プレリリース識別子からチャンネルレベルを返す
 *
 * @param prerelease - プレリリース識別子（例: "alpha.16", "beta.1", null）
 * @returns チャンネルレベル（数値が高いほど安定）
 */
function getPrereleaseLevel(prerelease: string | null): number {
  if (!prerelease) return 4; // stable
  if (prerelease.startsWith("rc")) return 3;
  if (prerelease.startsWith("beta")) return 2;
  if (prerelease.startsWith("alpha")) return 1;
  return 0; // unknown prerelease
}

/**
 * チャンネルの最小レベルを返す
 */
function getChannelMinLevel(channel: PluginChannel): number {
  switch (channel) {
    case "stable": return 4;
    case "rc": return 3;
    case "beta": return 2;
    case "alpha": return 1;
  }
}

/**
 * marketplace クローンのローカルパスを取得する
 *
 * known_marketplaces.json から installLocation を読み取る。
 *
 * @returns クローンパス、見つからない場合は null
 */
export function getMarketplaceClonePath(): string | null {
  return resolveMarketplaceInstallLocation();
}

/**
 * marketplace クローンの git タグからチャンネルに合致する最新バージョンを解決する
 *
 * @param channel - リリースチャンネル
 * @param clonePath - marketplace クローンのローカルパス
 * @returns 合致する最新バージョンタグ（"v" プレフィックス付き）、見つからない場合は null
 */
export async function resolveVersionByChannel(channel: PluginChannel, clonePath: string): Promise<string | null> {
  let tagsOutput: string;
  try {
    const git = simpleGit(clonePath);
    tagsOutput = await git.raw(["tag", "-l"]);
  } catch {
    return null;
  }

  const tags = tagsOutput.split("\n").map(t => t.trim()).filter(t => t.length > 0);
  if (tags.length === 0) return null;

  // "v" プレフィックス付きタグのみ対象（例: v0.2.0-alpha.16）
  const versionTags = tags.filter(tag => /^v?\d+\.\d+\.\d+/.test(tag));
  if (versionTags.length === 0) return null;

  const minLevel = getChannelMinLevel(channel);

  // チャンネルフィルタ: バージョンのプレリリースレベルが minLevel 以上
  const eligible = versionTags.filter(tag => {
    const version = tag.startsWith("v") ? tag.slice(1) : tag;
    const [, ...preParts] = version.split("-");
    const pre = preParts.length > 0 ? preParts.join("-") : null;
    return getPrereleaseLevel(pre) >= minLevel;
  });

  if (eligible.length === 0) return null;

  // semver ソートで最新を返す
  eligible.sort((a, b) => {
    const va = a.startsWith("v") ? a.slice(1) : a;
    const vb = b.startsWith("v") ? b.slice(1) : b;
    return compareSemver(vb, va); // 降順
  });

  return eligible[0];
}

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
export async function withMarketplaceVersion<T>(clonePath: string, tag: string, fn: () => T | Promise<T>): Promise<T> {
  const git = simpleGit(clonePath);
  // 指定タグにチェックアウト
  await git.checkout(tag);

  try {
    return await fn();
  } finally {
    // main ブランチに復帰
    try {
      await git.checkout("main");
    } catch {
      // main 復帰失敗時は強制復帰を試行
      try {
        await git.checkout(["-f", "main"]);
      } catch {
        // 強制復帰も失敗 — ログのみ（呼び出し元のエラーを優先）
      }
    }
  }
}

// ========================================
// Cache Registration
// ========================================

/**
 * Plugin identifier for Claude Code's plugin registry
 */
export const PLUGIN_REGISTRY_ID = "shirokuma-skills-en@shirokuma-library";

/**
 * Japanese plugin identifier for Claude Code's plugin registry
 */
export const PLUGIN_REGISTRY_ID_JA = "shirokuma-skills-ja@shirokuma-library";

/**
 * Hooks plugin identifier for Claude Code's plugin registry
 */
export const PLUGIN_REGISTRY_ID_HOOKS = "shirokuma-hooks@shirokuma-library";

/**
 * Optional plugin identifiers (framework-specific, installed on demand)
 */
export const OPTIONAL_PLUGIN_IDS: Record<string, { en: string; ja: string }> = {
  nextjs: {
    en: "shirokuma-nextjs-en@shirokuma-library",
    ja: "shirokuma-nextjs-ja@shirokuma-library",
  },
  infra: {
    en: "shirokuma-infra-en@shirokuma-library",
    ja: "shirokuma-infra-ja@shirokuma-library",
  },
};

/**
 * Detect which optional plugins are already installed in the global cache
 * or enabled in the project's settings.json.
 * Returns the keys (e.g., ["nextjs", "infra"]) for plugins found.
 */
export function detectInstalledOptionalPlugins(projectPath?: string): string[] {
  const cacheBase = join(getPluginCacheBaseRoot(), "shirokuma-library");
  const installed = new Set<string>();
  const totalKeys = Object.keys(OPTIONAL_PLUGIN_IDS).length;

  // Check global cache
  for (const [key, ids] of Object.entries(OPTIONAL_PLUGIN_IDS)) {
    const enName = ids.en.split("@")[0];
    const jaName = ids.ja.split("@")[0];
    const enExists = existsSync(join(cacheBase, enName));
    const jaExists = existsSync(join(cacheBase, jaName));
    if (enExists || jaExists) {
      installed.add(key);
    }
  }

  // Skip settings.json if all plugins already detected via cache
  if (installed.size >= totalKeys) {
    return [...installed];
  }

  // Check project settings.json enabledPlugins (#1786)
  try {
    const settingsPath = join(projectPath ?? process.cwd(), ".claude", "settings.json");
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    const enabledPlugins = settings.enabledPlugins ?? {};
    for (const [key, ids] of Object.entries(OPTIONAL_PLUGIN_IDS)) {
      if (installed.has(key)) continue;
      const enEnabled = enabledPlugins[ids.en] === true;
      const jaEnabled = enabledPlugins[ids.ja] === true;
      if (enEnabled || jaEnabled) {
        installed.add(key);
      }
    }
  } catch {
    // Ignore settings read errors (file missing, invalid JSON, etc.)
  }

  return [...installed];
}

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
export function registerPluginCache(
  projectPath: string,
  options: { reinstall?: boolean; registryId?: string } = {},
): CacheRegistrationResult {
  // Check if claude CLI is available
  if (!isClaudeCliAvailable()) {
    return {
      success: false,
      method: "skipped",
      message: "claude CLI not found in PATH",
    };
  }

  const id = options.registryId ?? PLUGIN_REGISTRY_ID;

  // In reinstall mode (e.g., same-version update), uninstall first
  if (options.reinstall) {
    try {
      execFileSync(
        "claude",
        ["plugin", "uninstall", id, "--scope", "project"],
        { cwd: projectPath, stdio: "pipe", timeout: 30000 },
      );
    } catch {
      // Ignore uninstall errors (plugin might not be installed yet)
    }
  }

  // Install plugin to global cache
  try {
    execFileSync(
      "claude",
      ["plugin", "install", id, "--scope", "project"],
      { cwd: projectPath, stdio: "pipe", timeout: 30000 },
    );
    return {
      success: true,
      method: options.reinstall ? "reinstall" : "install",
    };
  } catch (error: unknown) {
    // Fallback: copy directly from marketplace clone to cache (#1786)
    // Bypasses Claude CLI managed state — plugin may not appear in `claude plugin list`
    const fallbackResult = copyPluginFromMarketplace(id, options.reinstall);
    if (fallbackResult) {
      return fallbackResult;
    }
    const stderr = isSpawnError(error) ? String(error.stderr) : "";
    return {
      success: false,
      method: options.reinstall ? "reinstall" : "install",
      message: stderr || (error instanceof Error ? error.message : String(error)),
    };
  }
}

/**
 * Copy a plugin directly from the marketplace clone to the global cache.
 * Used as a fallback when `claude plugin install` fails to find the plugin.
 */
function copyPluginFromMarketplace(registryId: string, reinstall?: boolean): CacheRegistrationResult | null {
  // Parse registryId: "plugin-name@marketplace-name"
  const atIdx = registryId.indexOf("@");
  if (atIdx < 0) return null;
  const pluginName = registryId.substring(0, atIdx);
  const marketplaceName = registryId.substring(atIdx + 1);

  const clonePath = getMarketplaceClonePath();
  if (!clonePath) return null;

  // Read version from plugin.json
  const pluginJsonPath = join(clonePath, pluginName, ".claude-plugin", "plugin.json");
  let version: string;
  try {
    const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
    version = pluginJson.version ?? "unknown";
  } catch {
    return null;
  }

  // Copy to cache: ~/.claude/plugins/cache/{marketplace}/{plugin}/{version}/
  const sourceDir = join(clonePath, pluginName);
  const cacheDir = join(getPluginCacheBaseRoot(), marketplaceName, pluginName, version);
  try {
    mkdirSync(cacheDir, { recursive: true });
    cpSync(sourceDir, cacheDir, { recursive: true });
    return {
      success: true,
      method: reinstall ? "reinstall" : "install",
      message: `Copied from marketplace clone (fallback)`,
    };
  } catch {
    return null;
  }
}

/**
 * Check if the `claude` CLI is available in PATH
 *
 * @returns true if claude CLI is installed and accessible
 */
export function isClaudeCliAvailable(): boolean {
  // テスト並列実行時のグローバルキャッシュ競合を防ぐため、
  // 環境変数で claude CLI 呼び出しを無効化できる (#632)
  if (process.env.SHIROKUMA_NO_CLAUDE_CLI) return false;
  try {
    execFileSync("claude", ["--version"], { stdio: "pipe", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for child_process spawn errors with stderr
 */
function isSpawnError(error: unknown): error is Error & { stderr: Buffer | string } {
  return error instanceof Error && "stderr" in error;
}

// ========================================
// Language Detection
// ========================================

/**
 * プロジェクトの .claude/settings.json から language 設定を読み取る
 *
 * @param projectPath - プロジェクトルートパス
 * @returns "english" | "japanese" | null（未設定時）
 */
export function getLanguageSetting(projectPath: string): string | null {
  const settingsPath = join(projectPath, ".claude", "settings.json");
  if (!existsSync(settingsPath)) {
    return null;
  }
  try {
    const content = readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(content) as { language?: string };
    return settings.language ?? null;
  } catch {
    return null;
  }
}

// ========================================
// Rule Cleanup
// ========================================

/**
 * Remove all deployed rules by deleting the deployed rules directory
 *
 * The directory is fully owned by shirokuma-flow, so the entire
 * directory is removed without per-file checks.
 *
 * @param projectPath - Project root path
 * @param options - Clean options (dryRun, verbose)
 * @returns Array of removed items (for reporting)
 */
export function cleanDeployedRules(
  projectPath: string,
  options: { dryRun?: boolean; verbose?: boolean } = {},
): DeployedRuleItem[] {
  const logger = createLogger(options.verbose ?? false);
  const targetDir = join(projectPath, DEPLOYED_RULES_DIR);
  const results: DeployedRuleItem[] = [];

  if (!existsSync(targetDir)) {
    return results;
  }

  // Collect all files for reporting
  const scanDir = (dir: string, prefix: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        results.push({ name: relativePath, status: "removed" });
        logger.debug(`  - ${relativePath} (removed)`);
      } else if (entry.isDirectory()) {
        scanDir(join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
      }
    }
  };

  scanDir(targetDir, "");

  // Remove entire directory
  if (!options.dryRun) {
    rmSync(targetDir, { recursive: true, force: true });
  }

  return results;
}

// ========================================
// Cache Version Cleanup
// ========================================

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
export function cleanupOldCacheVersions(pluginName: string, keepCount = 3): string[] {
  const cacheBase = join(getPluginCacheBaseRoot(), MARKETPLACE_NAME, pluginName);
  if (!existsSync(cacheBase)) return [];

  try {
    const versions = readdirSync(cacheBase)
      .filter(name => {
        if (name === "local") return false; // local/ は semver ではない (#1411)
        try { return statSync(join(cacheBase, name)).isDirectory(); }
        catch { return false; }
      })
      .sort((a, b) => compareSemver(b, a)); // 最新が先頭

    if (versions.length <= keepCount) return [];

    const toRemove = versions.slice(keepCount);
    const removed: string[] = [];

    for (const ver of toRemove) {
      try {
        rmSync(join(cacheBase, ver), { recursive: true, force: true });
        removed.push(ver);
      } catch {
        // 他プロセスが参照中の可能性 — 無視
      }
    }

    return removed;
  } catch {
    return [];
  }
}

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
export function cleanupLocalCacheDir(pluginName: string): boolean {
  const localDir = join(getPluginCacheBaseRoot(), MARKETPLACE_NAME, pluginName, "local");
  if (!existsSync(localDir)) return false;

  try {
    rmSync(localDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

// ========================================
// Local Plugin Installation (#1411)
// ========================================

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
export function installLocalPlugin(
  pluginName: string,
  sourcePath: string,
  options: { dryRun?: boolean } = {},
): LocalInstallResult {
  const cachePath = join(getPluginCacheBaseRoot(), MARKETPLACE_NAME, pluginName, "local");

  if (!existsSync(sourcePath)) {
    return {
      success: false,
      pluginName,
      cachePath,
      message: `ソースディレクトリが見つかりません: ${sourcePath}`,
    };
  }

  if (options.dryRun) {
    return { success: true, pluginName, cachePath };
  }

  try {
    // 既存の local/ をクリアして再インストール（冪等性確保）
    if (existsSync(cachePath)) {
      rmSync(cachePath, { recursive: true, force: true });
    }

    // ファイルを再帰的にコピー（Node.js 20+ の cpSync を使用）
    cpSync(sourcePath, cachePath, { recursive: true, force: true });

    return { success: true, pluginName, cachePath };
  } catch (error) {
    return {
      success: false,
      pluginName,
      cachePath,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

// ========================================
// Single Language Plugin Enforcement
// ========================================

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

// ========================================
// CLI Self-Update
// ========================================

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
 * `@shirokuma-library/flow` の依存があることを検証する。
 *
 * 開発環境（リポジトリ直接実行）の場合は `null` を返す。
 *
 * @returns wrapper ディレクトリのパス、検出できない場合は null
 */
export function getCliInstallDir(): string | null {
  const thisFile = fileURLToPath(import.meta.url);
  const nodeModulesIndex = thisFile.indexOf("/node_modules/");

  if (nodeModulesIndex === -1) {
    // 開発環境: リポジトリから直接実行されている
    return null;
  }

  const wrapperDir = thisFile.substring(0, nodeModulesIndex);

  // wrapper ディレクトリの package.json に依存があることを検証
  try {
    const pkgPath = join(wrapperDir, "package.json");
    if (!existsSync(pkgPath)) return null;

    const content = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content) as { dependencies?: Record<string, string> };
    if (!pkg.dependencies?.["@shirokuma-library/flow"]) {
      return null;
    }

    return wrapperDir;
  } catch {
    return null;
  }
}

/**
 * CLI パッケージを npm install で更新する
 *
 * @param installDir - wrapper ディレクトリのパス
 * @param options - オプション（dryRun）
 * @returns 更新結果
 */
export function updateCliPackage(
  installDir: string,
  options: { dryRun?: boolean } = {},
): CliUpdateResult {
  // npm の存在確認
  try {
    execFileSync("npm", ["--version"], { stdio: "pipe", timeout: 5000 });
  } catch {
    return {
      success: false,
      status: "skipped",
      message: "npm not found in PATH",
    };
  }

  // 更新前バージョンを取得（ESM キャッシュから）
  const oldVersion = getPackageVersion();

  if (options.dryRun) {
    return {
      success: true,
      status: "skipped",
      oldVersion,
      message: "dry-run mode",
    };
  }

  // npm install で更新
  try {
    execFileSync(
      "npm",
      ["install", "@shirokuma-library/flow@latest"],
      { cwd: installDir, stdio: "pipe", timeout: 90000 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      status: "failed",
      oldVersion,
      message,
    };
  }

  // 更新後バージョンをディスクから直接読み取り
  let newVersion: string;
  try {
    const pkgPath = join(installDir, "node_modules", "@shirokuma-library", "shirokuma-flow", "package.json");
    const content = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content) as { version?: string };
    newVersion = pkg.version ?? "unknown";
  } catch {
    newVersion = "unknown";
  }

  if (oldVersion === newVersion) {
    return {
      success: true,
      status: "upToDate",
      oldVersion,
      newVersion,
    };
  }

  return {
    success: true,
    status: "updated",
    oldVersion,
    newVersion,
  };
}

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
export function ensureSingleLanguagePlugin(
  projectPath: string,
  languageSetting: string | null,
  options: { verbose?: boolean } = {},
): SingleLanguageResult {
  const logger = createLogger(options.verbose ?? false);

  // 言語未設定の場合は安全側に倒してスキップ
  if (!languageSetting) {
    return { attempted: false, cacheRemoved: false };
  }

  // claude CLI が利用不可の場合はスキップ
  if (!isClaudeCliAvailable()) {
    return { attempted: false, cacheRemoved: false };
  }

  // 逆言語プラグインを特定
  const oppositeRegistryId = languageSetting === "japanese"
    ? PLUGIN_REGISTRY_ID
    : PLUGIN_REGISTRY_ID_JA;
  const oppositePluginName = languageSetting === "japanese"
    ? PLUGIN_NAME
    : PLUGIN_NAME_JA;

  // claude plugin uninstall を常に試行（インストール済みでなくてもエラーを無視）
  try {
    execFileSync(
      "claude",
      ["plugin", "uninstall", oppositeRegistryId, "--scope", "project"],
      { cwd: projectPath, stdio: "pipe", timeout: 15000 },
    );
    logger.debug(`${oppositeRegistryId}: uninstalled`);
  } catch {
    // 未インストールの場合のエラーは無視
  }

  // キャッシュディレクトリを削除
  let cacheRemoved = false;
  const cacheBase = join(getPluginCacheBaseRoot(), MARKETPLACE_NAME, oppositePluginName);
  if (existsSync(cacheBase)) {
    rmSync(cacheBase, { recursive: true, force: true });
    cacheRemoved = true;
    logger.debug(`${oppositePluginName}: cache directory removed`);
  }

  return {
    attempted: true,
    oppositePlugin: oppositePluginName,
    cacheRemoved,
  };
}

// ========================================
// Unified Plugin Installation (#1043)
// ========================================

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
  /**
   * リリース版への切り戻しを意図する操作（true）かどうか (#2474)。
   *
   * - true (`update-skills --sync` 等): `local/` を削除し reinstall を許可（dev モード破棄）
   * - false (デフォルト, `init` 等): `local/` 存在プラグインは reinstall と `cleanupLocalCacheDir` をスキップして dev モードを保護
   */
  forceReleaseSwitch?: boolean;
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
export async function installAllPlugins(
  options: InstallAllPluginsOptions,
): Promise<InstallAllPluginsResult> {
  const {
    projectPath,
    languageSetting,
    channel,
    reinstall = false,
    cleanupOldVersions = false,
    verbose = false,
  } = options;

  const emptyResult: InstallAllPluginsResult = {
    marketplaceOk: false,
    plugins: [],
    singleLanguage: { attempted: false, cacheRemoved: false },
    deployedRulesCleaned: false,
    cleanedVersions: {},
    cleanedLocalDirs: [],
  };

  // 1. marketplace 確認
  const marketplaceOk = await ensureMarketplace();
  if (!marketplaceOk) {
    return emptyResult;
  }

  // 2. registry IDs を構築（言語プラグイン + hooks + optional）
  const isJa = languageSetting === "japanese";
  const registryIds = [
    ...(isJa ? [PLUGIN_REGISTRY_ID_JA] : [PLUGIN_REGISTRY_ID]),
    PLUGIN_REGISTRY_ID_HOOKS,
  ];

  // 2b. オプショナルプラグインを追加 (#1552)
  const { optionalPlugins = [] } = options;
  for (const key of optionalPlugins) {
    const ids = OPTIONAL_PLUGIN_IDS[key];
    if (ids) {
      registryIds.push(isJa ? ids.ja : ids.en);
    }
  }

  // 3. プラグインインストール（チャンネルラップ対応 #961）
  // dev モード保護 (#2474): forceReleaseSwitch=false かつ local/ 存在時はスキップ
  const plugins: PluginInstallStatus[] = [];
  const installPlugins = () => {
    for (const registryId of registryIds) {
      if (!options.forceReleaseSwitch) {
        const pluginName = registryId.split("@")[0];
        const localDir = join(getPluginCacheBaseRoot(), MARKETPLACE_NAME, pluginName, "local");
        if (existsSync(localDir)) {
          plugins.push({
            registryId,
            success: true,
            message: "skipped (dev mode local/ detected)",
          });
          continue;
        }
      }
      const cacheResult = registerPluginCache(projectPath, { reinstall, registryId });
      plugins.push({
        registryId,
        success: cacheResult.success,
        message: cacheResult.message,
      });
    }
  };

  if (channel) {
    const clonePath = getMarketplaceClonePath();
    if (clonePath) {
      const tag = await resolveVersionByChannel(channel, clonePath);
      if (tag) {
        await withMarketplaceVersion(clonePath, tag, installPlugins);
      } else {
        installPlugins();
      }
    } else {
      installPlugins();
    }
  } else {
    installPlugins();
  }

  // 4. 逆言語プラグイン削除 (#812)
  const singleLanguage = ensureSingleLanguagePlugin(projectPath, languageSetting, { verbose });

  // 5. 逆言語削除が実行された場合、デプロイ済みルールをクリーン
  let deployedRulesCleaned = false;
  if (singleLanguage.attempted) {
    cleanDeployedRules(projectPath, { verbose });
    deployedRulesCleaned = true;
  }

  // 6. 古いキャッシュバージョンのクリーンアップ + local/ 削除 (#679, #1841)
  const cleanedVersions: Record<string, string[]> = {};
  const cleanedLocalDirs: string[] = [];
  if (cleanupOldVersions) {
    const pluginNames = isJa
      ? [PLUGIN_NAME_JA, PLUGIN_NAME_HOOKS]
      : [PLUGIN_NAME, PLUGIN_NAME_HOOKS];

    // オプショナルプラグインも対象に追加 (#1841)
    for (const key of options.optionalPlugins ?? []) {
      const ids = OPTIONAL_PLUGIN_IDS[key];
      if (ids) {
        pluginNames.push(isJa ? ids.ja.split("@")[0] : ids.en.split("@")[0]);
      }
    }

    for (const pn of pluginNames) {
      // local/ 削除はリリース版への切り戻しを意図する操作（forceReleaseSwitch=true）でのみ実行 (#2474)
      if (options.forceReleaseSwitch && cleanupLocalCacheDir(pn)) {
        console.warn(
          `[shirokuma-flow] dev モードプラグイン検出: ${pn}/local/ を削除しました。リリース版に切り戻しました。`,
        );
        cleanedLocalDirs.push(pn);
      }
      // 既存の semver バージョンクリーンアップ
      const removed = cleanupOldCacheVersions(pn);
      if (removed.length > 0) {
        cleanedVersions[pn] = removed;
      }
    }
  }

  return {
    marketplaceOk: true,
    plugins,
    singleLanguage,
    deployedRulesCleaned,
    cleanedVersions,
    cleanedLocalDirs,
  };
}

