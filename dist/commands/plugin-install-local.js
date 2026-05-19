/**
 * plugin-install-local command - ローカルプラグインをグローバルキャッシュにインストール
 *
 * @description plugin/{pluginName}/ ディレクトリをグローバルキャッシュ
 * (~/.claude/plugins/cache/shirokuma-library/{pluginName}/local/) にコピーし、
 * ルールを .shirokuma/rules/shirokuma/ に展開する。
 *
 * 開発中のプラグイン変更を `shirokuma-docs update` を実行せずに
 * 即座に反映させるためのコマンド。
 *
 * @example
 * ```bash
 * # 言語設定に基づき自動選択（最も一般的な使い方）
 * shirokuma-docs plugin-install-local
 *
 * # 特定のプラグインを指定
 * shirokuma-docs plugin-install-local --plugin shirokuma-skills-ja
 *
 * # 全プラグインをインストール
 * shirokuma-docs plugin-install-local --all
 *
 * # ドライラン（変更なし）
 * shirokuma-docs plugin-install-local --dry-run
 * ```
 */
import { join } from "node:path";
import { existsSync } from "node:fs";
import { validateProjectPath } from "../utils/sanitize.js";
import { createLogger } from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import { PLUGIN_NAME, PLUGIN_NAME_JA, PLUGIN_NAME_HOOKS, getBundledPluginPathFor, deployRules, getGlobalCachePath, getLanguageSetting, installLocalPlugin, } from "../utils/skills-repo.js";
/**
 * plugin-install-local command handler
 *
 * @param options - Command options
 * @returns Exit code (0 = success, 1 = error)
 */
export function pluginInstallLocalCommand(options) {
    const verbose = options.verbose ?? false;
    const logger = createLogger(verbose);
    const T = (key, params) => t(`commands.pluginInstallLocal.${key}`, params);
    const projectPath = validateProjectPath(options.project);
    // .claude ディレクトリの存在確認
    if (!existsSync(join(projectPath, ".claude"))) {
        logger.error(T("errorNoClaudeDir"));
        return 1;
    }
    if (options.dryRun) {
        logger.info(T("dryRunBanner"));
    }
    // 言語設定を1回だけ取得
    const languageSetting = getLanguageSetting(projectPath);
    // インストール対象プラグインを決定
    const pluginsToInstall = resolveTargetPlugins(options, languageSetting);
    if (pluginsToInstall.length === 0) {
        logger.error(T("errorNoPluginResolved"));
        return 1;
    }
    // 各プラグインをインストール
    const installResults = [];
    let hasError = false;
    for (const pluginName of pluginsToInstall) {
        const sourcePath = getBundledPluginPathFor(pluginName);
        if (!existsSync(sourcePath)) {
            logger.error(T("errorPluginDirNotFound", { pluginName, sourcePath }));
            hasError = true;
            continue;
        }
        logger.info(T("installingPlugin", { pluginName }));
        const result = installLocalPlugin(pluginName, sourcePath, { dryRun: options.dryRun });
        installResults.push(result);
        if (result.success) {
            logger.success(T("installedPlugin", { pluginName, cachePath: result.cachePath }));
        }
        else {
            logger.error(T("errorInstallFailed", { pluginName, reason: result.message ?? "unknown error" }));
            hasError = true;
        }
    }
    if (hasError) {
        return 1;
    }
    // ルール展開
    // local/ キャッシュが存在する場合は preferLocal=true で優先解決する
    const useJaRules = languageSetting === "japanese";
    // 言語設定に合わせてルール展開元を選択
    // --plugin 明示指定の場合はそのプラグインを使用、それ以外は言語設定に従う
    let rulesPluginName;
    if (options.plugin) {
        rulesPluginName = options.plugin;
    }
    else {
        rulesPluginName = useJaRules ? PLUGIN_NAME_JA : PLUGIN_NAME;
    }
    // local/ を優先して使用（インストールしたばかりのものを反映）
    const rulesSource = getGlobalCachePath(rulesPluginName, undefined, { preferLocal: true })
        ?? getBundledPluginPathFor(rulesPluginName);
    logger.info(T("deployingRules", { pluginName: rulesPluginName }));
    const deployResult = deployRules(projectPath, {
        dryRun: options.dryRun,
        verbose,
        bundledPluginPath: rulesSource,
    });
    const rulesDeployed = deployResult.deployed.filter(r => r.status === "deployed" || r.status === "updated").length;
    // サマリー表示
    printSummary(installResults, deployResult.deployed, options.dryRun ?? false, logger, T);
    // セッション再起動案内
    if (!options.dryRun) {
        logger.info("");
        logger.warn(T("restartSessionNotice"));
        logger.info(T("restartSessionHint"));
    }
    if (verbose) {
        const result = {
            pluginName: pluginsToInstall.join(", "),
            cachePath: installResults[0]?.cachePath ?? "",
            rulesDeployed,
            dryRun: options.dryRun ?? false,
        };
        console.log(JSON.stringify(result, null, 2));
    }
    return 0;
}
/**
 * インストール対象プラグインの一覧を決定する
 *
 * @param options - コマンドオプション
 * @param languageSetting - 言語設定（"japanese" | "english" | null）
 * @returns インストール対象プラグイン名の配列
 */
function resolveTargetPlugins(options, languageSetting) {
    // --all: 全プラグイン
    if (options.all) {
        return [PLUGIN_NAME, PLUGIN_NAME_JA, PLUGIN_NAME_HOOKS];
    }
    // --plugin: 明示指定
    if (options.plugin) {
        return [options.plugin];
    }
    // 自動選択: 言語設定に基づく
    if (languageSetting === "japanese") {
        return [PLUGIN_NAME_JA, PLUGIN_NAME_HOOKS];
    }
    // デフォルト（英語または未設定）
    return [PLUGIN_NAME, PLUGIN_NAME_HOOKS];
}
/**
 * インストール結果サマリーを表示する
 */
function printSummary(installResults, deployedRules, dryRun, logger, T) {
    logger.info(`\n${T("summaryHeader")}`);
    if (dryRun) {
        logger.info(T("dryRunNote"));
    }
    for (const r of installResults) {
        if (r.success) {
            logger.success(`✓ ${T("summaryPluginInstalled", { pluginName: r.pluginName })}`);
        }
        else {
            logger.error(`✗ ${T("summaryPluginFailed", { pluginName: r.pluginName })}`);
        }
    }
    let deployed = 0, updated = 0, unchanged = 0, errors = 0;
    for (const r of deployedRules) {
        if (r.status === "deployed")
            deployed++;
        else if (r.status === "updated")
            updated++;
        else if (r.status === "unchanged")
            unchanged++;
        else if (r.status === "error")
            errors++;
    }
    const parts = [];
    if (deployed > 0)
        parts.push(T("countDeployed", { count: deployed }));
    if (updated > 0)
        parts.push(T("countUpdated", { count: updated }));
    if (unchanged > 0)
        parts.push(T("countUnchanged", { count: unchanged }));
    if (errors > 0)
        parts.push(T("countError", { count: errors }));
    if (parts.length > 0) {
        const rulesMsg = T("deployedRulesSummary", { details: parts.join(", ") });
        if (errors > 0) {
            logger.error(`✗ ${rulesMsg}`);
        }
        else {
            logger.success(`✓ ${rulesMsg}`);
        }
    }
    if (errors > 0) {
        logger.error(`✗ ${T("completedError", { count: errors })}`);
    }
    else {
        logger.success(`✓ ${T("completedOk")}`);
    }
}
//# sourceMappingURL=plugin-install-local.js.map