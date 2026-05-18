/**
 * update-skills command - Update installed skills/rules from bundled plugin
 *
 * @description Updates installed skills and rules to the version bundled
 * in the shirokuma-flow package, preserving project/ directories.
 *
 * @example
 * ```bash
 * # Update all installed skills
 * shirokuma-flow update-skills
 *
 * # Update specific skills only
 * shirokuma-flow update-skills --skills managing-agents,review-issue
 *
 * # Update with rules
 * shirokuma-flow update-skills --with-rules
 *
 * # Preview changes without updating
 * shirokuma-flow update-skills --dry-run
 *
 * # Force update (ignore local changes)
 * shirokuma-flow update-skills --force
 *
 * # Sync mode: detect new/removed skills
 * shirokuma-flow update-skills --sync
 * ```
 */

import { join } from "node:path";
import { validateProjectPath } from "../utils/sanitize.js";
import { existsSync } from "node:fs";
import { createLogger } from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import { loadConfig, CONFIG_FILE } from "../utils/config.js";
import {
  PLUGIN_NAME,
  PLUGIN_NAME_JA,
  getBundledPluginPath,
  getBundledPluginPathJa,
  getPackageVersion,
  getPluginVersion,
  getPluginVersionFromGlobalCache,
  deployRules,
  getGlobalCachePath,
  isClaudeCliAvailable,
  getLanguageSetting,
  getCliInstallDir,
  updateCliPackage,
  installAllPlugins,
  detectInstalledOptionalPlugins,
  type DeployedRuleItem,
  type CliUpdateResult,
} from "../utils/skills-repo.js";

/**
 * update-skills command options
 */
interface UpdateSkillsOptions {
  /** Project path */
  project: string;
  /** Update rules as well */
  withRules?: boolean;
  /** Sync mode: detect and add new skills, detect removed skills */
  sync?: boolean;
  /** Auto-confirm destructive operations (removals) */
  yes?: boolean;
  /** Preview mode (no actual changes) */
  dryRun?: boolean;
  /** Force update (ignore local changes) */
  force?: boolean;
  /** Force global cache sync (claude plugin uninstall + install) */
  installCache?: boolean;
  /** Plugin release channel (overrides config) */
  channel?: "stable" | "rc" | "beta" | "alpha";
  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Update result for a single item
 */
interface UpdateItem {
  name: string;
  status: "updated" | "skipped" | "added" | "unchanged" | "error" | "removed";
  reason?: string;
}

/**
 * update-skills command result
 */
interface UpdateResult {
  skills: UpdateItem[];
  rules: UpdateItem[];
  deployedRules: DeployedRuleItem[];
  version: string;
  pluginVersion: string;
  dryRun: boolean;
  cliUpdate?: CliUpdateResult;
}

/**
 * update-skills command handler
 */
export async function updateSkillsCommand(options: UpdateSkillsOptions): Promise<number> {
  const verbose = options.verbose ?? false;
  const logger = createLogger(verbose);
  const T = (key: string, params?: Record<string, string | number>) =>
    t(`commands.updateSkills.${key}`, params);
  const projectPath = validateProjectPath(options.project);

  // Check if project has been initialized (.claude or .shirokuma directory)
  if (!existsSync(join(projectPath, ".claude")) && !existsSync(join(projectPath, ".shirokuma"))) {
    logger.error(T("errorNoClaudeDir"));
    return 1;
  }

  const newVersion = getPackageVersion();

  if (options.dryRun) {
    logger.info(T("dryRunBanner"));
  }

  logger.info(T("cliVersion", { version: newVersion }));

  // marketplace からキャッシュ経由で更新（#486, #674, #801）
  // バンドルプラグインが存在しなくても動作する
  const newPluginVersion = getPluginVersion();
  logger.info(T("pluginVersion", { version: newPluginVersion }));
  await updateExternalProject(projectPath, options, logger, T, newVersion, newPluginVersion, verbose);
  return 0;
}

/**
 * update-skills 本体: marketplace キャッシュ経由で更新（#486, #801）
 *
 * claude plugin update でリモートから最新を取得し、
 * ルールを .shirokuma/rules/shirokuma/ に展開する。
 */
async function updateExternalProject(
  projectPath: string,
  options: UpdateSkillsOptions,
  logger: ReturnType<typeof createLogger>,
  T: (key: string, params?: Record<string, string | number>) => string,
  newVersion: string,
  newPluginVersion: string,
  verbose: boolean,
): Promise<void> {
  const deployedRuleResults: DeployedRuleItem[] = [];
  let cliUpdateResult: CliUpdateResult | undefined;
  let cacheUpdated = false;

  // CLI 本体の自動更新 (#867)
  const installDir = getCliInstallDir();
  if (installDir) {
    logger.info(T("updatingCli"));
    cliUpdateResult = updateCliPackage(installDir, { dryRun: options.dryRun });
    if (cliUpdateResult.status === "updated") {
      logger.success(T("cliUpdated", {
        oldVersion: cliUpdateResult.oldVersion ?? "unknown",
        newVersion: cliUpdateResult.newVersion ?? "unknown",
      }));
    } else if (cliUpdateResult.status === "upToDate") {
      logger.info(T("cliAlreadyUpToDate"));
    } else if (cliUpdateResult.status === "failed") {
      logger.warn(T("cliUpdateFailed", { reason: cliUpdateResult.message ?? "unknown error" }));
    } else if (cliUpdateResult.status === "skipped" && cliUpdateResult.message === "npm not found in PATH") {
      logger.warn(T("cliUpdateSkippedNoNpm"));
    }
  } else {
    logger.debug(T("cliUpdateSkippedDev"));
  }

  // 言語設定を確認（#495: キャッシュ登録とルール展開の両方で使用）
  const languageSetting = getLanguageSetting(projectPath);

  // チャンネル設定を解決（CLI オプション > config > 未指定）
  const config = loadConfig(projectPath, CONFIG_FILE);
  const effectiveChannel = options.channel ?? config.plugins?.channel ?? undefined;

  if (effectiveChannel) {
    logger.info(`Plugin channel: ${effectiveChannel}`);
  }

  // claude CLI が利用可能な場合のみキャッシュ更新を実行 (#632: graceful degradation, #1043: 共通ユーティリティ)
  if (isClaudeCliAvailable()) {
    if (!options.dryRun) {
      logger.info(T("updatingGlobalCache"));
      const optionalPlugins = detectInstalledOptionalPlugins(projectPath);
      const installResult = await installAllPlugins({
        projectPath,
        languageSetting,
        channel: effectiveChannel,
        reinstall: true,
        cleanupOldVersions: true,
        // update-skills は明示的なリリース版同期コマンドのため dev モードを上書きする (#2474)
        forceReleaseSwitch: true,
        verbose,
        optionalPlugins,
      });

      if (!installResult.marketplaceOk) {
        logger.warn("Marketplace registration failed, proceeding with bundled fallback");
      } else {
        for (const p of installResult.plugins) {
          if (p.success) {
            logger.success(`${p.registryId}: ${T("globalCacheUpdated")}`);
          } else {
            logger.warn(`${p.registryId}: ${p.message ?? "update failed"}`);
          }
        }

        cacheUpdated = true;

        for (const [pn, removed] of Object.entries(installResult.cleanedVersions)) {
          logger.debug(`${pn}: ${removed.length} old cache version(s) removed`);
        }

        for (const pn of installResult.cleanedLocalDirs) {
          logger.info(`${pn}: local/ cache removed`);
        }

        if (installResult.singleLanguage.attempted) {
          logger.debug(`${installResult.singleLanguage.oppositePlugin}: opposite language plugin removed`);
        }
      }
    }
  } else {
    logger.warn(T("errorNoClaudeCli"));
    logger.info("Proceeding with bundled fallback for rule deployment");
  }

  // ルール展開（キャッシュ → bundled フォールバック）
  // #636: 外部プロジェクトではキャッシュからデプロイするため hasJaPlugin() 不要
  const useJaRules = languageSetting === "japanese";

  if (useJaRules) {
    logger.info(T("deployingRulesJa"));
    const jaRulesSource = getGlobalCachePath(PLUGIN_NAME_JA) ?? getBundledPluginPathJa();
    const deployResult = deployRules(projectPath, {
      dryRun: options.dryRun,
      verbose: options.verbose ?? false,
      bundledPluginPath: jaRulesSource,
      cleanup: true,
    });
    deployedRuleResults.push(...deployResult.deployed);
  } else {
    logger.info(T("deployingRules"));
    const enRulesSource = getGlobalCachePath(PLUGIN_NAME) ?? getBundledPluginPath();
    const deployResult = deployRules(projectPath, {
      dryRun: options.dryRun,
      verbose: options.verbose ?? false,
      bundledPluginPath: enRulesSource,
      cleanup: true,
    });
    deployedRuleResults.push(...deployResult.deployed);
  }

  // 更新後のバージョンを再計算 (#934)
  // CLI: updateCliPackage() が返す newVersion を優先（実行中プロセスの ESM キャッシュをバイパス）
  const finalVersion = cliUpdateResult?.status === "updated" && cliUpdateResult.newVersion
    ? cliUpdateResult.newVersion
    : newVersion;
  // プラグイン: キャッシュ更新後はグローバルキャッシュから直接読み取り（バンドルフォールバックをバイパス）
  let finalPluginVersion = newPluginVersion;
  if (cacheUpdated) {
    const activePluginName = languageSetting === "japanese" ? PLUGIN_NAME_JA : PLUGIN_NAME;
    finalPluginVersion = getPluginVersionFromGlobalCache(activePluginName) ?? newPluginVersion;
  }

  // Summary
  const result: UpdateResult = {
    skills: [],
    rules: [],
    deployedRules: deployedRuleResults,
    version: finalVersion,
    pluginVersion: finalPluginVersion,
    dryRun: options.dryRun ?? false,
    cliUpdate: cliUpdateResult,
  };

  printSummary(result, logger);

  if (verbose) {
    console.log(JSON.stringify(result, null, 2));
  }
}

/**
 * Print update summary
 */
function printSummary(
  result: UpdateResult,
  logger: ReturnType<typeof createLogger>
): void {
  const T = (key: string, params?: Record<string, string | number>) =>
    t(`commands.updateSkills.${key}`, params);

  logger.info(`\n${T("summaryHeader")}`);

  const countByStatus = (items: UpdateItem[]) => {
    const counts = { updated: 0, added: 0, skipped: 0, unchanged: 0, error: 0, removed: 0 };
    for (const item of items) {
      counts[item.status]++;
    }
    return counts;
  };

  const formatCounts = (counts: Record<string, number>, keys: { key: string; field: string }[]) => {
    const parts: string[] = [];
    for (const { key, field } of keys) {
      if (counts[field] > 0) parts.push(T(key, { count: counts[field] }));
    }
    return parts;
  };

  const itemCountKeys = [
    { key: "countUpdated", field: "updated" },
    { key: "countAdded", field: "added" },
    { key: "countRemoved", field: "removed" },
    { key: "countSkipped", field: "skipped" },
    { key: "countUnchanged", field: "unchanged" },
    { key: "countError", field: "error" },
  ];

  const deployCountKeys = [
    { key: "countDeployed", field: "deployed" },
    { key: "countUpdated", field: "updated" },
    { key: "countUnchanged", field: "unchanged" },
    { key: "countError", field: "error" },
  ];

  const skillCounts = countByStatus(result.skills);
  const ruleCounts = countByStatus(result.rules);

  if (result.dryRun) {
    logger.info(T("dryRunNote"));
  }

  logger.info(T("cliVersion", { version: result.version }));
  logger.info(T("pluginVersion", { version: result.pluginVersion }));

  // CLI 自動更新結果 (#867)
  if (result.cliUpdate) {
    const cu = result.cliUpdate;
    if (cu.status === "updated") {
      logger.success(`✓ ${T("cliUpdateSummary", { oldVersion: cu.oldVersion ?? "unknown", newVersion: cu.newVersion ?? "unknown" })}`);
    } else if (cu.status === "upToDate") {
      logger.info(`✓ ${T("cliAlreadyUpToDate")}`);
    } else if (cu.status === "failed") {
      logger.warn(`⚠ ${T("cliUpdateFailed", { reason: cu.message ?? "unknown error" })}`);
    }
  }

  let totalErrors = 0;

  // スキル
  const skillParts = formatCounts(skillCounts, itemCountKeys);
  totalErrors += skillCounts.error;

  if (skillParts.length > 0) {
    const skillMsg = T("skillsSummary", { details: skillParts.join(", ") });
    if (skillCounts.error > 0) {
      logger.error(`✗ ${skillMsg}`);
    } else {
      logger.success(`✓ ${skillMsg}`);
    }
  }

  // ルール
  if (result.rules.length > 0) {
    const ruleParts = formatCounts(ruleCounts, itemCountKeys);
    totalErrors += ruleCounts.error;

    if (ruleParts.length > 0) {
      const ruleMsg = T("rulesSummary", { details: ruleParts.join(", ") });
      if (ruleCounts.error > 0) {
        logger.error(`✗ ${ruleMsg}`);
      } else {
        logger.success(`✓ ${ruleMsg}`);
      }
    }
  }

  // デプロイ済みルール
  if (result.deployedRules.length > 0) {
    const deployCounts = { deployed: 0, updated: 0, unchanged: 0, error: 0, removed: 0 };
    for (const item of result.deployedRules) {
      deployCounts[item.status]++;
    }

    const deployParts = formatCounts(deployCounts, deployCountKeys);
    totalErrors += deployCounts.error;

    if (deployParts.length > 0) {
      const deployMsg = T("deployedRulesSummary", { details: deployParts.join(", ") });
      if (deployCounts.error > 0) {
        logger.error(`✗ ${deployMsg}`);
      } else {
        logger.success(`✓ ${deployMsg}`);
      }
    }
  }

  // 全体の OK/NG インジケーター
  if (totalErrors > 0) {
    logger.error(`✗ ${T("completedError", { count: totalErrors })}`);
  } else {
    logger.success(`✓ ${T("completedOk")}`);
  }

  // セッション再起動案内（#589）
  if (!result.dryRun) {
    logger.info("");
    logger.warn(T("restartSessionNotice"));
    logger.info(T("restartSessionHint"));
  }
}
