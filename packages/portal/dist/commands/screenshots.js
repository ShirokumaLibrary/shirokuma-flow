/**
 * screenshots コマンド - 画面スクリーンショット自動生成
 *
 * 画面情報を取得する方法:
 * 1. annotations: page.tsx の @screenshot アノテーションからスキャン
 * 2. feature-map: feature-map.json の screens から取得
 * 3. config: 設定ファイルに直接定義された screens から取得
 * 4. both: annotations と feature-map の両方を統合
 *
 * 機能:
 * - 動的ルート ([locale], [orgSlug] 等) を設定値で置換
 * - Playwright スクリプトを自動生成（scripts/screenshots/ に出力）
 * - --run オプションで即時実行
 *
 * 出力先:
 * - スクリプト: scripts/screenshots/capture-screens.playwright.ts
 * - スクリーンショット: docs/portal/screenshots/
 *
 * 注意: E2Eテスト (tests/e2e/) とは別管理
 */
import { resolve, dirname, relative } from "node:path";
import { globSync } from "glob";
import { spawnAsync } from "../utils/spawn-async.js";
import { loadConfig, getOutputPath } from "../utils/config.js";
import { ensureDir, writeFile, readFile, fileExists } from "../utils/file.js";
import { createLogger } from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import { parseScreenshotAnnotations } from "../parsers/screenshot-annotations.js";
import { inferRouteFromPath, applyRouteParams } from "../utils/route-inference.js";
import { escapeRegExp } from "@shirokuma-library/lint";
/**
 * パスからアプリ名を推測
 * 例: "apps/admin/app/..." → "admin"
 *     "apps/public/app/..." → "public"
 */
function inferAppFromPath(path) {
    if (!path)
        return undefined;
    const match = path.match(/^apps\/([^/]+)\//);
    return match ? match[1] : undefined;
}
/**
 * デフォルト設定
 */
const defaultScreenshotsConfig = {
    enabled: true,
    source: "feature-map",
    scanPaths: ["apps/*/app/**/*page.tsx"],
    screens: [],
    baseUrl: "https://localhost:3000",
    locale: "ja",
    accounts: {},
    defaultAccount: "",
    loginPath: "/login",
    auth: {
        email: "admin@example.com",
        password: "Admin@Test2024!",
        loginPath: "/login",
    },
    viewport: {
        width: 1280,
        height: 720,
    },
    outputDir: "docs/portal/screenshots",
    testFile: "scripts/screenshots/capture-screens.playwright.ts",
    routeParams: {
        "[locale]": "ja",
        "[orgSlug]": "test-org",
        "[projectSlug]": "test-project",
        "[sessionId]": "test-session",
        "[entityId]": "test-entity",
    },
    appBaseUrls: {},
    screenOverrides: {},
    dynamicRoutes: {
        enabled: false,
        helperModule: "./tests/helpers/database",
        paramMethods: {},
        databaseUrl: "",
    },
    apps: {},
};
/**
 * アプリ別設定をマージして完全な設定を生成
 */
function getAppConfig(baseConfig, appId, appSettings) {
    return {
        ...baseConfig,
        baseUrl: appSettings.baseUrl ?? baseConfig.baseUrl,
        testFile: appSettings.testFile ?? `scripts/screenshots/${appId}.playwright.ts`,
        outputDir: appSettings.outputDir ?? `${baseConfig.outputDir}/${appId}`,
        screenOverrides: { ...baseConfig.screenOverrides, ...appSettings.screenOverrides },
        auth: appSettings.auth === null
            ? { email: "", password: "", loginPath: "" }
            : appSettings.auth
                ? { ...baseConfig.auth, ...appSettings.auth }
                : baseConfig.auth,
    };
}
/**
 * screenshots コマンド
 */
export async function screenshotsCommand(options) {
    const logger = createLogger(options.verbose ?? false);
    const projectPath = resolve(options.project);
    logger.info(`スクリーンショット生成テストを作成: ${projectPath}`);
    // 設定読み込み
    const config = loadConfig(projectPath, options.config);
    const rawScreenshots = config.screenshots;
    logger.debug(`Raw screenshots keys: ${JSON.stringify(Object.keys(rawScreenshots || {}))}`);
    const screenshotsConfig = mergeScreenshotsConfig(defaultScreenshotsConfig, rawScreenshots);
    logger.debug(`Merged screenOverrides: ${JSON.stringify(screenshotsConfig.screenOverrides)}`);
    if (!screenshotsConfig.enabled) {
        logger.warn(t("commands.screenshots.disabled"));
        return 0;
    }
    // ソースに応じて画面を収集
    let screens = [];
    switch (screenshotsConfig.source) {
        case "annotations":
            screens = collectFromAnnotations(projectPath, screenshotsConfig, logger);
            break;
        case "config":
            screens = collectFromConfig(screenshotsConfig, logger);
            break;
        case "both":
            const annotationScreens = collectFromAnnotations(projectPath, screenshotsConfig, logger);
            const featureMapScreens = collectFromFeatureMap(projectPath, config, logger);
            screens = mergeScreens(annotationScreens, featureMapScreens);
            break;
        case "feature-map":
        default:
            screens = collectFromFeatureMap(projectPath, config, logger);
            break;
    }
    logger.info(`${screens.length} 件の画面を検出 (source: ${screenshotsConfig.source})`);
    if (screens.length === 0) {
        logger.warn(t("commands.screenshots.noScreensFound"));
        return 0;
    }
    // アプリ別設定があるかチェック
    const hasAppConfigs = screenshotsConfig.apps && Object.keys(screenshotsConfig.apps).length > 0;
    if (hasAppConfigs) {
        // マルチアプリモード: アプリごとに別ファイル生成
        await generateMultiAppScreenshots(screens, screenshotsConfig, projectPath, options, logger);
    }
    else {
        // シングルアプリモード: 従来の動作（後方互換）
        await generateSingleAppScreenshots(screens, screenshotsConfig, projectPath, options, logger);
    }
    return 0;
}
/**
 * シングルアプリモード: 従来の1ファイル生成
 */
async function generateSingleAppScreenshots(screens, screenshotsConfig, projectPath, options, logger) {
    // Playwright スクリプト生成
    const testContent = generateTestFile(screens, screenshotsConfig, projectPath, logger);
    const testFilePath = resolve(projectPath, screenshotsConfig.testFile);
    ensureDir(dirname(testFilePath));
    writeFile(testFilePath, testContent);
    logger.success(`スクリーンショットスクリプトを生成: ${testFilePath}`);
    // 出力ディレクトリ作成
    const outputDir = resolve(projectPath, screenshotsConfig.outputDir);
    ensureDir(outputDir);
    logger.debug(`スクリーンショット出力先: ${outputDir}`);
    // マニフェスト生成（ポータル表示用）
    const manifest = generateManifest(screens, screenshotsConfig, logger);
    const manifestPath = resolve(outputDir, "screenshots.json");
    writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    logger.success(`スクリーンショットマニフェストを生成: ${manifestPath}`);
    // --run オプションで即時実行
    if (options.run) {
        logger.info(t("commands.screenshots.runningPlaywright"));
        const result = await spawnAsync("npx", ["playwright", "test", testFilePath, "--reporter=list"], {
            cwd: projectPath,
            stdio: "inherit",
        });
        if (result.exitCode === 0) {
            logger.success(t("commands.screenshots.screenshotsDone"));
        }
        else {
            logger.error(t("commands.screenshots.playwrightFailed"));
            if (result.stderr) {
                logger.debug(result.stderr);
            }
        }
    }
    else {
        logger.info(t("commands.screenshots.runManuallyHint"));
        logger.info(`  npx playwright test ${screenshotsConfig.testFile}`);
        logger.info(t("commands.screenshots.rerunWithRunFlag"));
    }
}
/**
 * マルチアプリモード: アプリごとに別ファイル生成
 */
async function generateMultiAppScreenshots(allScreens, baseConfig, projectPath, options, logger) {
    const appConfigs = baseConfig.apps;
    const appIds = Object.keys(appConfigs);
    logger.info(`マルチアプリモード: ${appIds.length} アプリ (${appIds.join(", ")})`);
    // アプリごとにスクリーンを分類
    const screensByApp = new Map();
    const unassignedScreens = [];
    for (const screen of allScreens) {
        if (screen.app && appIds.includes(screen.app)) {
            const existing = screensByApp.get(screen.app) || [];
            existing.push(screen);
            screensByApp.set(screen.app, existing);
        }
        else {
            unassignedScreens.push(screen);
        }
    }
    if (unassignedScreens.length > 0) {
        logger.warn(`${unassignedScreens.length} 件のスクリーンがアプリに紐付けられていません:`);
        unassignedScreens.forEach(s => logger.warn(`  - ${s.name} (path: ${s.path || "N/A"})`));
    }
    const generatedFiles = [];
    const allManifests = {};
    // 各アプリのファイルを生成
    for (const appId of appIds) {
        const appSettings = appConfigs[appId];
        if (appSettings.enabled === false) {
            logger.debug(`アプリ "${appId}" はスキップ (enabled: false)`);
            continue;
        }
        const appScreens = screensByApp.get(appId) || [];
        if (appScreens.length === 0) {
            logger.warn(`アプリ "${appId}" にはスクリーンがありません`);
            continue;
        }
        logger.info(`\n📱 ${appId}: ${appScreens.length} 件のスクリーン`);
        // アプリ固有の設定を生成
        const appConfig = getAppConfig(baseConfig, appId, appSettings);
        // Playwright スクリプト生成
        const testContent = generateTestFileForApp(appScreens, appConfig, appId, projectPath, logger);
        const testFilePath = resolve(projectPath, appConfig.testFile);
        ensureDir(dirname(testFilePath));
        writeFile(testFilePath, testContent);
        logger.success(`  スクリプト: ${testFilePath}`);
        generatedFiles.push(testFilePath);
        // 出力ディレクトリ作成
        const outputDir = resolve(projectPath, appConfig.outputDir);
        ensureDir(outputDir);
        // マニフェスト生成
        const manifest = generateManifest(appScreens, appConfig, logger);
        const manifestPath = resolve(outputDir, "screenshots.json");
        writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        logger.success(`  マニフェスト: ${manifestPath}`);
        allManifests[appId] = manifest;
    }
    // 統合マニフェスト生成（全アプリのインデックス）
    const indexManifestPath = resolve(projectPath, baseConfig.outputDir, "index.json");
    ensureDir(dirname(indexManifestPath));
    writeFile(indexManifestPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        apps: Object.keys(allManifests),
        manifests: allManifests,
    }, null, 2));
    logger.success(`\n統合マニフェスト: ${indexManifestPath}`);
    // --run オプションで即時実行
    if (options.run && generatedFiles.length > 0) {
        logger.info(t("commands.screenshots.runningPlaywright"));
        for (const testFile of generatedFiles) {
            const relativePath = relative(projectPath, testFile);
            logger.info(`  実行中: ${relativePath}`);
            const result = await spawnAsync("npx", ["playwright", "test", testFile, "--reporter=list"], {
                cwd: projectPath,
                stdio: "inherit",
            });
            if (result.exitCode !== 0) {
                logger.error(`  エラー: ${relativePath}`);
                if (result.stderr) {
                    logger.debug(result.stderr);
                }
            }
        }
        logger.success(t("commands.screenshots.screenshotsDone"));
    }
    else if (generatedFiles.length > 0) {
        logger.info(t("commands.screenshots.runManuallyHint"));
        for (const testFile of generatedFiles) {
            const relativePath = relative(projectPath, testFile);
            logger.info(`  npx playwright test ${relativePath}`);
        }
        logger.info(t("commands.screenshots.runAllHint"));
        logger.info(`  npx playwright test scripts/screenshots/`);
        logger.info(t("commands.screenshots.rerunWithRunFlag"));
    }
}
/**
 * アプリ別テストファイルを生成
 * 認証なし（auth: null）の場合はログインをスキップ
 */
function generateTestFileForApp(screens, config, appId, projectPath, logger) {
    const tasks = expandScreensToTasks(screens, config, logger);
    const dynamicRoutesEnabled = config.dynamicRoutes.enabled;
    const requiresAuth = config.auth.email !== "";
    logger.info(`  ${tasks.length} 件のタスク (認証: ${requiresAuth ? "必要" : "不要"})${dynamicRoutesEnabled ? " [動的ルート有効]" : ""}`);
    // 動的ルート解決用のインポート
    let helperImportPath = config.dynamicRoutes.helperModule ?? "./tests/helpers/database";
    if (dynamicRoutesEnabled && helperImportPath.startsWith("./")) {
        const testFileDir = config.testFile.split("/").slice(0, -1).join("/");
        const depth = testFileDir.split("/").filter(Boolean).length;
        const prefix = "../".repeat(depth);
        helperImportPath = prefix + helperImportPath.slice(2);
    }
    const dynamicRoutesImport = dynamicRoutesEnabled
        ? `import { testDb } from '${helperImportPath}';\n`
        : "";
    const dynamicRoutesSetupCode = dynamicRoutesEnabled
        ? `
    // ===== 動的ルート解決: テストDBからエンティティIDを取得 =====
    console.log('🔍 テストDBからエンティティIDを取得中...');
    await testDb.connect();
    const entityIds = await testDb.getScreenshotEntityIds();
    await testDb.disconnect();
    console.log('✅ エンティティID取得完了:', JSON.stringify(entityIds, null, 2));

    const missingIds = Object.entries(entityIds)
      .filter(([, value]) => value === null)
      .map(([key]) => key);
    if (missingIds.length > 0) {
      console.warn('⚠️ 以下のエンティティIDが取得できませんでした:', missingIds.join(', '));
    }
`
        : "";
    // ログインURL（baseUrl + loginPath）
    const loginUrl = `${config.baseUrl}${config.auth.loginPath || "/login"}`;
    // ログインコード（認証が必要な場合のみ）
    const loginCode = requiresAuth
        ? `
    // ===== ログイン =====
    console.log('🔐 ログイン中...');
    await page.goto('${loginUrl}');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('textbox', { name: /Email|メールアドレス/i }).fill('${config.auth.email}');
    await page.getByLabel(/^Password$|^パスワード$/i).fill('${config.auth.password}');
    await page.getByRole('button', { name: /login|ログイン|Log in|Sign in/i }).click();

    // ログイン成功を確認
    await page.waitForURL(/\\/(${config.locale})?(\\/|$)/, { timeout: 15000 });
    // セッションCookieの確立を待つ
    await page.waitForLoadState('networkidle').catch(() => { console.log('⚠️ networkidle タイムアウト - 続行'); });
    await page.waitForTimeout(1000);
    console.log('✅ ログイン成功');
`
        : `
    // ===== 認証不要モード =====
    console.log('🔓 認証なしで撮影開始');
`;
    // スクリーンショットステップを生成（baseUrlを渡す）
    const screenshotSteps = tasks.map((task, index) => {
        const isFirstInGroup = index === 0;
        return generateScreenshotCodeForApp(task, config, index, isFirstInGroup, config.baseUrl);
    });
    return `/**
 * Screen Screenshots for ${appId.toUpperCase()} App
 *
 * このファイルは shirokuma-flow screenshots コマンドで自動生成されました。
 *
 * 実行: npx playwright test ${config.testFile}
 *
 * 生成日時: ${new Date().toISOString()}
 * アプリ: ${appId}
 * スクリーンショット数: ${tasks.length}
 * 認証: ${requiresAuth ? "必要" : "不要"}
 *${dynamicRoutesEnabled ? " * 動的ルート: 有効\n *" : ""}
 * @generated
 */

import { test, expect } from '@playwright/test';
${dynamicRoutesImport}
test.describe('${appId.toUpperCase()} Screenshots', () => {
  test('Capture ${appId} screenshots', async ({ page }) => {
    test.setTimeout(${tasks.length * 30000 + 60000});

    await page.setViewportSize({
      width: ${config.viewport.width},
      height: ${config.viewport.height}
    });

    // ビューポートサイズインジケーターが消えるのを待つ
    await page.waitForTimeout(2000);
${dynamicRoutesSetupCode}${loginCode}
    console.log('📷 ${tasks.length}画面を撮影します...');
${screenshotSteps.join("\n")}

    console.log('\\n✅ 全${tasks.length}件のスクリーンショット撮影完了');
  });
});
`;
}
/**
 * 設定をマージ
 */
function mergeScreenshotsConfig(base, override) {
    if (!override) {
        return base;
    }
    return {
        enabled: override.enabled ?? base.enabled,
        source: override.source ?? base.source,
        scanPaths: override.scanPaths ?? base.scanPaths,
        screens: override.screens ?? base.screens,
        baseUrl: override.baseUrl ?? base.baseUrl,
        locale: override.locale ?? base.locale,
        accounts: override.accounts ?? base.accounts,
        defaultAccount: override.defaultAccount ?? base.defaultAccount,
        loginPath: override.loginPath ?? override.auth?.loginPath ?? base.loginPath,
        auth: {
            email: override.auth?.email ?? base.auth.email,
            password: override.auth?.password ?? base.auth.password,
            loginPath: override.auth?.loginPath ?? base.auth.loginPath,
        },
        viewport: {
            width: override.viewport?.width ?? base.viewport.width,
            height: override.viewport?.height ?? base.viewport.height,
        },
        outputDir: override.outputDir ?? base.outputDir,
        testFile: override.testFile ?? base.testFile,
        routeParams: { ...base.routeParams, ...override.routeParams },
        appBaseUrls: { ...base.appBaseUrls, ...override.appBaseUrls },
        screenOverrides: { ...base.screenOverrides, ...override.screenOverrides },
        dynamicRoutes: {
            enabled: override.dynamicRoutes?.enabled ?? base.dynamicRoutes.enabled,
            helperModule: override.dynamicRoutes?.helperModule ?? base.dynamicRoutes.helperModule,
            paramMethods: { ...base.dynamicRoutes.paramMethods, ...override.dynamicRoutes?.paramMethods },
            databaseUrl: override.dynamicRoutes?.databaseUrl ?? base.dynamicRoutes.databaseUrl,
        },
        apps: override.apps ?? base.apps,
    };
}
/**
 * アノテーションから画面を収集
 */
function collectFromAnnotations(projectPath, config, logger) {
    const screens = [];
    for (const pattern of config.scanPaths) {
        const files = globSync(pattern, {
            cwd: projectPath,
            absolute: true,
            ignore: ["**/node_modules/**"],
        });
        logger.debug(`スキャンパターン: ${pattern} (${files.length} files)`);
        for (const file of files) {
            const content = readFile(file);
            if (!content)
                continue;
            const relativePath = relative(projectPath, file);
            const annotation = parseScreenshotAnnotations(content, relativePath);
            if (annotation) {
                // ルートを決定: @route アノテーション or ファイルパスから推論
                const route = annotation.route || inferRouteFromPath(relativePath);
                if (!route) {
                    logger.warn(`ルートを推論できませんでした: ${relativePath}`);
                    continue;
                }
                screens.push({
                    name: annotation.name,
                    path: relativePath,
                    route,
                    description: annotation.description,
                    viewport: annotation.viewport,
                    auth: annotation.auth,
                    waitFor: annotation.waitFor,
                    waitForSelectors: annotation.waitForSelectors,
                    delay: annotation.delay,
                    accounts: annotation.accounts,
                });
                logger.debug(`  @screenshot 検出: ${annotation.name} -> ${route}${annotation.accounts ? ` (accounts: ${annotation.accounts.join(", ")})` : ""}`);
            }
        }
    }
    return screens;
}
/**
 * feature-map.json から画面を収集
 */
function collectFromFeatureMap(projectPath, config, logger) {
    const portalPath = getOutputPath(config, projectPath, "portal");
    const featureMapPath = resolve(portalPath, "feature-map.json");
    if (!fileExists(featureMapPath)) {
        logger.warn(`feature-map.json が見つかりません: ${featureMapPath}`);
        logger.info(t("commands.screenshots.featureMapFirst"));
        return [];
    }
    const featureMapContent = readFile(featureMapPath);
    if (!featureMapContent) {
        logger.error(t("commands.screenshots.featureMapReadFailed"));
        return [];
    }
    let featureMap;
    try {
        featureMap = JSON.parse(featureMapContent);
    }
    catch {
        logger.error(t("commands.screenshots.featureMapParseFailed"));
        return [];
    }
    const screens = [];
    // features からスクリーンを収集
    for (const [, group] of Object.entries(featureMap.features)) {
        if (group.screens && Array.isArray(group.screens)) {
            for (const screen of group.screens) {
                if (screen.route) {
                    screens.push({
                        name: screen.name,
                        path: screen.path,
                        route: screen.route,
                        description: screen.description,
                        app: inferAppFromPath(screen.path),
                    });
                }
            }
        }
    }
    // uncategorized からスクリーンを収集
    if (featureMap.uncategorized?.screens) {
        for (const screen of featureMap.uncategorized.screens) {
            if (screen.route) {
                screens.push({
                    name: screen.name,
                    path: screen.path,
                    route: screen.route,
                    description: screen.description,
                    app: inferAppFromPath(screen.path),
                });
            }
        }
    }
    // 重複を除去 (name ベース)
    const uniqueScreens = new Map();
    for (const screen of screens) {
        if (!uniqueScreens.has(screen.name)) {
            uniqueScreens.set(screen.name, screen);
        }
    }
    return Array.from(uniqueScreens.values());
}
/**
 * 設定ファイルから直接画面を取得
 */
function collectFromConfig(config, _logger) {
    return config.screens.map((screen) => ({
        name: screen.name,
        route: screen.route,
        description: screen.description,
        viewport: screen.viewport,
        auth: screen.auth,
        waitFor: screen.waitFor,
        delay: screen.delay,
    }));
}
/**
 * 複数ソースの画面をマージ (annotations が優先)
 */
function mergeScreens(annotationScreens, featureMapScreens) {
    const merged = new Map();
    // feature-map を先に追加
    for (const screen of featureMapScreens) {
        merged.set(screen.name, screen);
    }
    // annotations で上書き (優先)
    for (const screen of annotationScreens) {
        merged.set(screen.name, screen);
    }
    return Array.from(merged.values());
}
/**
 * ルートパラメータを置換
 * screenOverridesにスクリーン名が存在する場合はそちらを優先
 */
function resolveRoute(route, routeParams, screenName, screenOverrides) {
    // screenOverridesに完全なルートが定義されていればそれを使用
    if (screenName && screenOverrides && screenOverrides[screenName]) {
        return screenOverrides[screenName];
    }
    return applyRouteParams(route, routeParams);
}
/**
 * マルチアカウント対応かどうかを判定
 */
function isMultiAccountMode(config) {
    return Object.keys(config.accounts).length > 0;
}
/**
 * 有効なアカウント設定を取得（後方互換性対応）
 */
function getEffectiveAccounts(config) {
    if (Object.keys(config.accounts).length > 0) {
        return config.accounts;
    }
    // 後方互換: auth設定を "default" アカウントとして扱う
    return {
        default: {
            email: config.auth.email ?? "admin@example.com",
            password: config.auth.password ?? "Admin@Test2024!",
            label: "Default",
        },
    };
}
/**
 * デフォルトアカウント名を取得
 */
function getDefaultAccountName(config) {
    if (config.defaultAccount && config.accounts[config.defaultAccount]) {
        return config.defaultAccount;
    }
    const accountNames = Object.keys(getEffectiveAccounts(config));
    return accountNames[0] || "default";
}
/**
 * ログインパスを取得
 */
function getLoginPath(config) {
    return config.loginPath || config.auth.loginPath || "/login";
}
/**
 * スクリーンショットタスクを生成（アカウントごとに展開）
 */
function expandScreensToTasks(screens, config, logger) {
    const tasks = [];
    const accounts = getEffectiveAccounts(config);
    const defaultAccountName = getDefaultAccountName(config);
    const multiAccountMode = isMultiAccountMode(config);
    for (const screen of screens) {
        // 画面に指定されたアカウント、またはデフォルトアカウント
        const targetAccounts = screen.accounts && screen.accounts.length > 0
            ? screen.accounts
            : [defaultAccountName];
        for (const accountName of targetAccounts) {
            const accountConfig = accounts[accountName];
            if (!accountConfig) {
                logger.warn(`アカウント "${accountName}" が設定に存在しません (画面: ${screen.name})`);
                continue;
            }
            // ファイル名: マルチアカウントかつ複数アカウント指定の場合はサフィックス付与
            const needsSuffix = multiAccountMode && targetAccounts.length > 1;
            const outputFileName = needsSuffix
                ? `${screen.name}-${accountName}.png`
                : `${screen.name}.png`;
            tasks.push({
                screen,
                accountName,
                accountConfig,
                outputFileName,
            });
        }
    }
    return tasks;
}
/**
 * タスクをアカウントごとにグループ化
 */
function groupTasksByAccount(tasks) {
    const grouped = new Map();
    for (const task of tasks) {
        const existing = grouped.get(task.accountName) || [];
        existing.push(task);
        grouped.set(task.accountName, existing);
    }
    return grouped;
}
/**
 * スクリーンショットマニフェストを生成
 */
function generateManifest(screens, config, logger) {
    const tasks = expandScreensToTasks(screens, config, logger);
    const multiAccountMode = isMultiAccountMode(config);
    const screenshots = {};
    for (const task of tasks) {
        const resolvedRoute = resolveRoute(task.screen.route, config.routeParams, task.screen.name, config.screenOverrides);
        // マルチアカウントモードで複数アカウントがある場合はアカウント名をキーに含める
        const key = multiAccountMode && task.screen.accounts && task.screen.accounts.length > 1
            ? `${task.screen.name}:${task.accountName}`
            : task.screen.name;
        const viewport = task.screen.viewport || {
            width: config.viewport.width ?? 1280,
            height: config.viewport.height ?? 720,
        };
        screenshots[key] = {
            name: task.screen.name,
            fileName: task.outputFileName,
            route: resolvedRoute,
            description: task.screen.description,
            sourcePath: task.screen.path,
            account: multiAccountMode ? task.accountName : undefined,
            viewport,
        };
    }
    logger.debug(`マニフェスト生成: ${Object.keys(screenshots).length} エントリ`);
    return {
        generatedAt: new Date().toISOString(),
        config: {
            baseUrl: config.baseUrl,
            viewport: {
                width: config.viewport.width ?? 1280,
                height: config.viewport.height ?? 720,
            },
            outputDir: config.outputDir,
        },
        screenshots,
    };
}
/**
 * 動的ルートを解決（テンプレートリテラル形式）
 *
 * screenOverridesにスクリーン名が存在する場合はそちらを優先
 * dynamicRoutesが有効な場合は、[id]形式のパラメータを${entityIds.xxx}形式に変換
 */
function resolveRouteForDynamicMode(route, routeParams, screenName, screenOverrides, dynamicRoutes) {
    // screenOverridesに完全なルートが定義されていればそれを使用（静的）
    if (screenName && screenOverrides && screenOverrides[screenName]) {
        // screenOverridesも動的パラメータを含む可能性があるのでチェック
        const overrideRoute = screenOverrides[screenName];
        if (dynamicRoutes.enabled) {
            return convertToDynamicRoute(overrideRoute, dynamicRoutes);
        }
        return { route: overrideRoute, isDynamic: false };
    }
    // routeParamsで静的置換
    const resolvedRoute = applyRouteParams(route, routeParams);
    // dynamicRoutesが有効な場合は残りの[xxx]パターンを動的変数に変換
    if (dynamicRoutes.enabled) {
        return convertToDynamicRoute(resolvedRoute, dynamicRoutes);
    }
    return { route: resolvedRoute, isDynamic: false };
}
/**
 * ルート内の[xxx]パターンを${entityIds.xxx}形式に変換
 * ルートのパスからエンティティタイプを推論して適切なIDを使用
 */
function convertToDynamicRoute(route, dynamicRoutes) {
    let isDynamic = false;
    // カスタムマッピングがあれば使用
    const paramMethods = dynamicRoutes.paramMethods || {};
    // ルートからエンティティタイプを推論（例: /categories/[id]/edit -> "category"）
    const entityType = inferEntityTypeFromRoute(route);
    // パターン: [id], [categoryId], [slug] など
    const paramPattern = /\[([a-zA-Z]+)\]/g;
    const convertedRoute = route.replace(paramPattern, (_match, paramName) => {
        isDynamic = true;
        // カスタムマッピングをチェック
        const customMapping = paramMethods[`[${paramName}]`];
        if (customMapping) {
            return `\${entityIds.${customMapping}}`;
        }
        // 明示的な名前（categoryId, tagId等）はそのまま使用
        const explicitMappings = {
            "categoryId": "categoryId",
            "tagId": "tagId",
            "postId": "postId",
            "userId": "userId",
            "categorySlug": "categorySlug",
            "tagSlug": "tagSlug",
            "postSlug": "postSlug",
        };
        if (explicitMappings[paramName]) {
            return `\${entityIds.${explicitMappings[paramName]}}`;
        }
        // [id] や [slug] の場合はルートからエンティティタイプを推論
        if (paramName === "id" && entityType) {
            return `\${entityIds.${entityType}Id}`;
        }
        if (paramName === "slug" && entityType) {
            return `\${entityIds.${entityType}Slug}`;
        }
        // フォールバック: デフォルトマッピング
        const fallbackMappings = {
            "id": "categoryId",
            "slug": "postSlug",
        };
        const mappedName = fallbackMappings[paramName] || paramName;
        return `\${entityIds.${mappedName}}`;
    });
    return { route: convertedRoute, isDynamic };
}
/**
 * ルートパスからエンティティタイプを推論
 * 例: /categories/[id]/edit -> "category"
 *     /posts/[slug] -> "post"
 */
function inferEntityTypeFromRoute(route) {
    // パスセグメントを抽出（ドメイン部分を除去）
    const pathPart = route.replace(/^https?:\/\/[^/]+/, "");
    // パターンマッチでエンティティタイプを推論
    const patterns = [
        { pattern: /\/categories\//, type: "category" },
        { pattern: /\/category\//, type: "category" },
        { pattern: /\/tags\//, type: "tag" },
        { pattern: /\/tag\//, type: "tag" },
        { pattern: /\/posts\//, type: "post" },
        { pattern: /\/post\//, type: "post" },
        { pattern: /\/users\//, type: "user" },
        { pattern: /\/user\//, type: "user" },
    ];
    for (const { pattern, type } of patterns) {
        if (pattern.test(pathPart)) {
            return type;
        }
    }
    return null;
}
/**
 * スクリーンショット撮影コードを生成
 */
/**
 * エラーチェックコードを生成
 * 404/500エラー、Next.jsエラーページ、一般的なエラー表示、ログインリダイレクトを検出
 */
function generateErrorCheckCode(screenName, route) {
    return `
    // エラーチェック
    {
      const pageTitle = await page.title();
      const h1Text = await page.locator('h1').first().textContent().catch(() => '');
      const currentUrl = page.url();
      const hasErrorIndicator =
        pageTitle.includes('404') ||
        pageTitle.includes('500') ||
        pageTitle.toLowerCase().includes('error') ||
        pageTitle.toLowerCase().includes('not found') ||
        (h1Text && (
          h1Text.includes('404') ||
          h1Text.includes('500') ||
          h1Text.toLowerCase().includes('error') ||
          h1Text.toLowerCase().includes('not found') ||
          h1Text.toLowerCase().includes('something went wrong')
        ));

      // ログインページへのリダイレクト検出
      const isLoginRedirect = currentUrl.includes('/login') || currentUrl.includes('/sign-in') ||
        pageTitle.toLowerCase().includes('login') || pageTitle.toLowerCase().includes('sign in') ||
        (h1Text && (
          h1Text.toLowerCase().includes('login') ||
          h1Text.toLowerCase().includes('sign in') ||
          h1Text.toLowerCase().includes('log in') ||
          h1Text.toLowerCase().includes('ログイン')
        ));

      if (hasErrorIndicator) {
        console.warn('  ⚠️  ${screenName}: エラーページを検出 (${route})');
        console.warn('      Title: ' + pageTitle);
        console.warn('      H1: ' + (h1Text || '(empty)'));
      }

      if (isLoginRedirect && '${route}' !== '/login' && '${route}' !== '/sign-in') {
        console.warn('  ⚠️  ${screenName}: ログインページにリダイレクトされました (${route})');
        console.warn('      Current URL: ' + currentUrl);
        console.warn('      認証が切れている可能性があります');
      }
    }`;
}
function generateScreenshotCode(task, config, index, isFirstInGroup) {
    const { screen, outputFileName } = task;
    // 動的ルート解決（dynamicRoutes有効時はテンプレートリテラル形式）
    const { route: resolvedRoute, isDynamic } = resolveRouteForDynamicMode(screen.route, config.routeParams, screen.name, config.screenOverrides, config.dynamicRoutes);
    const screenshotPath = `${config.outputDir}/${outputFileName}`;
    const waitFor = screen.waitFor || "networkidle";
    const waitForSelectors = screen.waitForSelectors;
    const delay = screen.delay ?? 500;
    // セレクター待機コードを生成
    const waitForSelectorsCode = waitForSelectors && waitForSelectors.length > 0
        ? waitForSelectors.map((selector) => `    await expect(page.locator('${selector.replace(/'/g, "\\'")}').first()).toBeVisible({ timeout: 10000 });`).join("\n") + "\n"
        : "";
    // ルート表示文字列（ログ用 - 動的な場合はプレースホルダーを含む）
    const displayRoute = resolvedRoute.replace(/\$\{entityIds\.([a-zA-Z]+)\}/g, '{$1}');
    // エラーチェックコードを生成
    const errorCheckCode = generateErrorCheckCode(screen.name, displayRoute);
    // gotoのURL（動的な場合はテンプレートリテラル、静的な場合は文字列）
    const gotoUrl = isDynamic ? `\`${resolvedRoute}\`` : `'${resolvedRoute}'`;
    // ダッシュボードルート（ロケールのみ）を判定
    const dashboardRoutePattern = new RegExp(`^/${escapeRegExp(config.locale)}/?$`);
    const isDashboardRoute = !isDynamic && dashboardRoutePattern.test(resolvedRoute);
    // ダッシュボードルートはログイン後すでにいるのでナビゲート不要（グループ内最初のスクリーンショット用）
    if (isDashboardRoute && isFirstInGroup) {
        return `
    // === ${index + 1}. ${screen.name} ===
    console.log('  [${index + 1}] ${screen.name} (${displayRoute})');
    await page.waitForLoadState('load');
${waitForSelectorsCode}    await page.waitForTimeout(1000);
    // フォント読み込み完了とレイアウト安定化を待機
    await page.evaluate(async () => {
      await document.fonts.ready;
      // レイアウト再計算を強制（offsetHeightの読み取りでreflow発生）
      document.body.offsetHeight;
      // 次のペイントサイクルを待つ
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    // 開発用オーバーレイを非表示（ビューポートインジケーター等）
    await page.evaluate(() => {
      document.querySelectorAll('[data-debug], [data-viewport], .tailwind-indicator, .viewport-indicator').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
      // 右下の解像度表示バッジを非表示（absolute bottom-* right-* のパターン）
      document.querySelectorAll('.absolute.bottom-2.right-2, .absolute.bottom-4.right-4').forEach(el => {
        const text = el.textContent || '';
        if (/\\d+.*×.*\\d+/.test(text)) {
          (el as HTMLElement).style.display = 'none';
        }
      });
    });
${errorCheckCode}
    await page.screenshot({
      path: '${screenshotPath}',
      fullPage: true
    });`;
    }
    return `
    // === ${index + 1}. ${screen.name} ===
    console.log('  [${index + 1}] ${screen.name} (${isDynamic ? `' + ${gotoUrl} + '` : displayRoute})');
    await page.goto(${gotoUrl}, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('${waitFor}', { timeout: 15000 }).catch((e) => {
      console.log('    ⚠️ ${waitFor}タイムアウト - 続行', e?.message ?? '');
    });
${waitForSelectorsCode}    await page.waitForTimeout(${delay});
    // フォント読み込み完了とレイアウト安定化を待機
    await page.evaluate(async () => {
      await document.fonts.ready;
      // レイアウト再計算を強制（offsetHeightの読み取りでreflow発生）
      document.body.offsetHeight;
      // 次のペイントサイクルを待つ
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    // 開発用オーバーレイを非表示（ビューポートインジケーター等）
    await page.evaluate(() => {
      document.querySelectorAll('[data-debug], [data-viewport], .tailwind-indicator, .viewport-indicator').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
      // 右下の解像度表示バッジを非表示（absolute bottom-* right-* のパターン）
      document.querySelectorAll('.absolute.bottom-2.right-2, .absolute.bottom-4.right-4').forEach(el => {
        const text = el.textContent || '';
        if (/\\d+.*×.*\\d+/.test(text)) {
          (el as HTMLElement).style.display = 'none';
        }
      });
    });
${errorCheckCode}
    await page.screenshot({
      path: '${screenshotPath}',
      fullPage: true
    });`;
}
/**
 * アプリ別スクリーンショット撮影コードを生成
 * baseUrlを考慮して絶対URLを構築
 */
function generateScreenshotCodeForApp(task, config, index, isFirstInGroup, baseUrl) {
    const { screen, outputFileName } = task;
    // 動的ルート解決（dynamicRoutes有効時はテンプレートリテラル形式）
    const { route: resolvedRoute, isDynamic } = resolveRouteForDynamicMode(screen.route, config.routeParams, screen.name, config.screenOverrides, config.dynamicRoutes);
    const screenshotPath = `${config.outputDir}/${outputFileName}`;
    const waitFor = screen.waitFor || "networkidle";
    const waitForSelectors = screen.waitForSelectors;
    const delay = screen.delay ?? 500;
    // セレクター待機コードを生成
    const waitForSelectorsCode = waitForSelectors && waitForSelectors.length > 0
        ? waitForSelectors.map((selector) => `    await expect(page.locator('${selector.replace(/'/g, "\\'")}').first()).toBeVisible({ timeout: 10000 });`).join("\n") + "\n"
        : "";
    // ルート表示文字列（ログ用 - 動的な場合はプレースホルダーを含む）
    const displayRoute = resolvedRoute.replace(/\$\{entityIds\.([a-zA-Z]+)\}/g, '{$1}');
    // エラーチェックコードを生成
    const errorCheckCode = generateErrorCheckCode(screen.name, displayRoute);
    // baseUrlを適用（相対パスの場合のみ）
    // 動的ルートの場合はテンプレートリテラルで構築
    let gotoUrl;
    if (isDynamic) {
        // 動的ルート: テンプレートリテラル
        if (resolvedRoute.startsWith('http://') || resolvedRoute.startsWith('https://')) {
            // 既に絶対URL
            gotoUrl = `\`${resolvedRoute}\``;
        }
        else {
            // 相対パス: baseUrlを先頭に追加
            gotoUrl = `\`${baseUrl}${resolvedRoute}\``;
        }
    }
    else {
        // 静的ルート
        if (resolvedRoute.startsWith('http://') || resolvedRoute.startsWith('https://')) {
            // 既に絶対URL
            gotoUrl = `'${resolvedRoute}'`;
        }
        else {
            // 相対パス: baseUrlを先頭に追加
            gotoUrl = `'${baseUrl}${resolvedRoute}'`;
        }
    }
    // ダッシュボードルート（ロケールのみ）を判定
    const dashboardRoutePattern = new RegExp(`^/${escapeRegExp(config.locale)}/?$`);
    const isDashboardRoute = !isDynamic && dashboardRoutePattern.test(resolvedRoute);
    // ダッシュボードルートはログイン後すでにいるのでナビゲート不要（グループ内最初のスクリーンショット用）
    if (isDashboardRoute && isFirstInGroup) {
        return `
    // === ${index + 1}. ${screen.name} ===
    console.log('  [${index + 1}] ${screen.name} (${displayRoute})');
    await page.waitForLoadState('load');
${waitForSelectorsCode}    await page.waitForTimeout(1000);
    // フォント読み込み完了とレイアウト安定化を待機
    await page.evaluate(async () => {
      await document.fonts.ready;
      // レイアウト再計算を強制（offsetHeightの読み取りでreflow発生）
      document.body.offsetHeight;
      // 次のペイントサイクルを待つ
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    // 開発用オーバーレイを非表示（ビューポートインジケーター等）
    await page.evaluate(() => {
      document.querySelectorAll('[data-debug], [data-viewport], .tailwind-indicator, .viewport-indicator').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
      // 右下の解像度表示バッジを非表示（absolute bottom-* right-* のパターン）
      document.querySelectorAll('.absolute.bottom-2.right-2, .absolute.bottom-4.right-4').forEach(el => {
        const text = el.textContent || '';
        if (/\\d+.*×.*\\d+/.test(text)) {
          (el as HTMLElement).style.display = 'none';
        }
      });
    });
${errorCheckCode}
    await page.screenshot({
      path: '${screenshotPath}',
      fullPage: true
    });`;
    }
    return `
    // === ${index + 1}. ${screen.name} ===
    console.log('  [${index + 1}] ${screen.name} (${isDynamic ? `' + ${gotoUrl} + '` : displayRoute})');
    await page.goto(${gotoUrl}, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('${waitFor}', { timeout: 15000 }).catch((e) => {
      console.log('    ⚠️ ${waitFor}タイムアウト - 続行', e?.message ?? '');
    });
${waitForSelectorsCode}    await page.waitForTimeout(${delay});
    // フォント読み込み完了とレイアウト安定化を待機
    await page.evaluate(async () => {
      await document.fonts.ready;
      // レイアウト再計算を強制（offsetHeightの読み取りでreflow発生）
      document.body.offsetHeight;
      // 次のペイントサイクルを待つ
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    // 開発用オーバーレイを非表示（ビューポートインジケーター等）
    await page.evaluate(() => {
      document.querySelectorAll('[data-debug], [data-viewport], .tailwind-indicator, .viewport-indicator').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
      // 右下の解像度表示バッジを非表示（absolute bottom-* right-* のパターン）
      document.querySelectorAll('.absolute.bottom-2.right-2, .absolute.bottom-4.right-4').forEach(el => {
        const text = el.textContent || '';
        if (/\\d+.*×.*\\d+/.test(text)) {
          (el as HTMLElement).style.display = 'none';
        }
      });
    });
${errorCheckCode}
    await page.screenshot({
      path: '${screenshotPath}',
      fullPage: true
    });`;
}
/**
 * Playwright テストファイルを生成
 *
 * マルチアカウント対応:
 * - accounts 設定がある場合: アカウントごとにグループ化して撮影
 * - accounts 設定がない場合: 従来の単一アカウント方式（後方互換）
 *
 * 動的ルート解決:
 * - dynamicRoutes.enabled が true の場合: テストDBからエンティティIDを取得
 * - helperModule で指定されたモジュールから testDb をインポート
 *
 * ログイン回数を最小化するため、同一アカウントの画面をまとめて撮影
 */
function generateTestFile(screens, config, _projectPath, logger) {
    const tasks = expandScreensToTasks(screens, config, logger);
    const groupedTasks = groupTasksByAccount(tasks);
    const accounts = getEffectiveAccounts(config);
    const loginPath = getLoginPath(config);
    const multiAccountMode = isMultiAccountMode(config);
    const dynamicRoutesEnabled = config.dynamicRoutes.enabled;
    logger.info(`${tasks.length} 件のスクリーンショットタスクを生成 (${groupedTasks.size} アカウント)${dynamicRoutesEnabled ? " [動的ルート有効]" : ""}`);
    // アカウントグループごとのコード生成
    const accountGroups = [];
    let globalIndex = 0;
    for (const [accountName, accountTasks] of groupedTasks) {
        const accountConfig = accounts[accountName];
        const accountLabel = accountConfig.label || accountName;
        const isFirstAccount = accountGroups.length === 0;
        // ログイン/ログアウトコード
        const loginCode = isFirstAccount
            ? `
    // ===== ${accountLabel} (${accountName}) でログイン =====
    console.log('\\n🔐 ${accountLabel} (${accountName}) でログイン中...');
    await page.goto('${loginPath}');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('textbox', { name: /Email|メールアドレス/i }).fill('${accountConfig.email}');
    await page.getByLabel(/^Password$|^パスワード$/i).fill('${accountConfig.password}');
    await page.getByRole('button', { name: /login|ログイン|Log in|Sign in/i }).click();

    // ログイン成功を確認
    await page.waitForURL(/\\/(${config.locale})?(\\/|$)/, { timeout: 15000 });
    await expect(page.locator('[data-sidebar="sidebar"]').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ ${accountLabel} でログイン成功');`
            : `
    // ===== ${accountLabel} (${accountName}) に切り替え =====
    console.log('\\n🔄 ${accountLabel} (${accountName}) に切り替え中...');

    // ログアウト
    await page.goto('${loginPath}?logout=true');
    await page.waitForLoadState('domcontentloaded');
    // ログアウトボタンがある場合はクリック（サイト実装による）
    const logoutBtn = page.getByRole('button', { name: /logout|ログアウト|Sign out/i });
    if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutBtn.click();
      await page.waitForLoadState('networkidle');
    }

    // 再ログイン
    await page.goto('${loginPath}');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('textbox', { name: /Email|メールアドレス/i }).fill('${accountConfig.email}');
    await page.getByLabel(/^Password$|^パスワード$/i).fill('${accountConfig.password}');
    await page.getByRole('button', { name: /login|ログイン|Log in|Sign in/i }).click();

    // ログイン成功を確認
    await page.waitForURL(/\\/(${config.locale})?(\\/|$)/, { timeout: 15000 });
    await expect(page.locator('[data-sidebar="sidebar"]').first()).toBeVisible({ timeout: 10000 });
    console.log('✅ ${accountLabel} でログイン成功');`;
        // このアカウントで撮影する画面
        const screenshotSteps = accountTasks.map((task, localIndex) => {
            const isFirstInGroup = localIndex === 0;
            const code = generateScreenshotCode(task, config, globalIndex, isFirstInGroup);
            globalIndex++;
            return code;
        });
        accountGroups.push(`${loginCode}

    // ${accountLabel} で ${accountTasks.length} 画面を撮影
    console.log('📷 ${accountLabel}: ${accountTasks.length}画面を撮影します...');
${screenshotSteps.join("\n")}`);
    }
    // 統計情報
    const accountStats = Array.from(groupedTasks.entries())
        .map(([name, tasks]) => `${accounts[name]?.label || name}: ${tasks.length}画面`)
        .join(", ");
    // 動的ルート解決用のインポートとセットアップコード
    // helperModuleをtestFileの位置から相対パスに変換
    let helperImportPath = config.dynamicRoutes.helperModule ?? "./tests/helpers/database";
    if (dynamicRoutesEnabled && helperImportPath.startsWith("./")) {
        // testFileのディレクトリ深さを計算して相対パスを調整
        // 例: testFile = "scripts/screenshots/capture.ts" -> depth = 2
        //     helperModule = "./tests/helpers/database" -> "../../tests/helpers/database"
        const testFileDir = config.testFile.split("/").slice(0, -1).join("/");
        const depth = testFileDir.split("/").filter(Boolean).length;
        const prefix = "../".repeat(depth);
        helperImportPath = prefix + helperImportPath.slice(2);
    }
    const dynamicRoutesImport = dynamicRoutesEnabled
        ? `import { testDb } from '${helperImportPath}';\n`
        : "";
    const dynamicRoutesSetupCode = dynamicRoutesEnabled
        ? `
    // ===== 動的ルート解決: テストDBからエンティティIDを取得 =====
    console.log('🔍 テストDBからエンティティIDを取得中...');
    await testDb.connect();
    const entityIds = await testDb.getScreenshotEntityIds();
    await testDb.disconnect();
    console.log('✅ エンティティID取得完了:', JSON.stringify(entityIds, null, 2));

    // IDが取得できなかった場合は警告
    const missingIds = Object.entries(entityIds)
      .filter(([, value]) => value === null)
      .map(([key]) => key);
    if (missingIds.length > 0) {
      console.warn('⚠️ 以下のエンティティIDが取得できませんでした:', missingIds.join(', '));
      console.warn('   該当する画面は404になる可能性があります');
    }
`
        : "";
    const dynamicRoutesNote = dynamicRoutesEnabled
        ? ` * 動的ルート: 有効（テストDBからエンティティIDを取得）\n *`
        : "";
    const testContent = `/**
 * Screen Screenshots for Documentation
 *
 * このファイルは shirokuma-flow screenshots コマンドで自動生成されました。
 * 手動編集は推奨されません。再生成時に上書きされます。
 *
 * 注意: これはE2Eテストではなく、ドキュメント用スクリーンショット撮影スクリプトです。
 * 実行: npx playwright test ${config.testFile}
 *
 * 生成日時: ${new Date().toISOString()}
 * 対象画面数: ${screens.length}
 * スクリーンショット数: ${tasks.length}
 * アカウント数: ${groupedTasks.size}${multiAccountMode ? ` (${accountStats})` : ""}
 * ソース: ${config.source}
 *${dynamicRoutesNote}
 * @generated
 */

import { test, expect } from '@playwright/test';
${dynamicRoutesImport}
test.describe('Screen Screenshots for Documentation', () => {
  /**
   * 全画面のスクリーンショットを一括撮影
   *
   * ${multiAccountMode ? "マルチアカウントモード: アカウントごとにログインして撮影" : "シングルアカウントモード: 1回のログインで全画面撮影"}
   * - ログイン回数を最小化（アカウント数: ${groupedTasks.size}）
   * - セッションが維持される（認証状態を共有）${dynamicRoutesEnabled ? "\n   * - 動的ルート: テストDBからエンティティIDを取得" : ""}
   */
  test('Capture all screenshots', async ({ page }) => {
    // タイムアウトを延長（全画面分 + アカウント切り替え分）
    test.setTimeout(${tasks.length * 30000 + groupedTasks.size * 30000 + 60000});

    // ビューポート設定
    await page.setViewportSize({
      width: ${config.viewport.width},
      height: ${config.viewport.height}
    });

    // ビューポートサイズインジケーターが消えるのを待つ
    await page.waitForTimeout(2000);
${dynamicRoutesSetupCode}${accountGroups.join("\n")}

    console.log('\\n✅ 全${tasks.length}件のスクリーンショット撮影完了');
  });
});
`;
    return testContent;
}
//# sourceMappingURL=screenshots.js.map