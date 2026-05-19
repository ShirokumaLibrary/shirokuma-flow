/**
 * details コマンド - 詳細ページ生成
 *
 * feature-map.json, test-cases.json, linked-docs.json を読み込み、
 * 各要素（Screen, Component, Action, Table）の詳細ページを生成する。
 *
 * ロジックは以下のモジュールに分割:
 * - details-types.ts: 型定義
 * - details-context.ts: コンテキスト管理・リンク解決
 * - details-jsdoc.ts: JSDoc解析
 * - details-zod.ts: Zodスキーマ解析
 * - details-test-analysis.ts: テスト分析
 * - details-styles.ts: CSS・スクリプト
 * - details-html.ts: コアHTML生成
 * - details-entity-pages.ts: エンティティ詳細ページ
 * - details-module-page.ts: モジュール概要ページ
 */
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadConfig, getOutputPath } from "../utils/config.js";
import { ensureDir, writeFile } from "../utils/file.js";
import { createLogger } from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import { createDetailsContext, extractModuleName, getElementFullKey } from "./details-context.js";
import { findTestCasesForModule } from "../analyzers/details-test-analysis.js";
import { generateScreenDetailPage, generateComponentDetailPage, generateActionDetailPage, generateTableDetailPage, generateModuleItemDetailPage, } from "../generators/details-entity-pages.js";
import { generateModuleDetailPage } from "../generators/details-module-page.js";
/**
 * details コマンドのメインハンドラ
 */
export function detailsCommand(options) {
    const logger = createLogger(options.verbose);
    const projectPath = resolve(options.project);
    // コンテキスト作成
    const ctx = createDetailsContext();
    logger.info(t("commands.details.generating"));
    // 設定読み込み
    const config = loadConfig(projectPath, options.config);
    const portalDir = getOutputPath(config, projectPath, "portal");
    const detailsDir = resolve(portalDir, "details");
    // 入力ファイルのパス
    const featureMapPath = resolve(portalDir, "feature-map.json");
    const testCasesPath = resolve(portalDir, "test-cases.json");
    // 必須ファイルの存在チェック
    if (!existsSync(featureMapPath)) {
        logger.error(t("commands.details.featureMapNotFound", { path: featureMapPath }));
        logger.info(t("commands.details.runFeatureMapFirst"));
        return 1;
    }
    // feature-map.json 読み込み
    const featureMap = JSON.parse(readFileSync(featureMapPath, "utf-8"));
    logger.info(t("commands.details.featureMapLoaded"));
    // test-cases.json 読み込み（オプション）
    if (existsSync(testCasesPath)) {
        const testCasesJson = JSON.parse(readFileSync(testCasesPath, "utf-8"));
        ctx.allTestCases = testCasesJson.testCases;
        logger.info(t("commands.details.testCasesLoaded", { count: ctx.allTestCases.length }));
    }
    else {
        logger.warn(t("commands.details.testCasesNotFound"));
    }
    // ディレクトリ作成
    ensureDir(resolve(detailsDir, "screen"));
    ensureDir(resolve(detailsDir, "component"));
    ensureDir(resolve(detailsDir, "action"));
    ensureDir(resolve(detailsDir, "module"));
    ensureDir(resolve(detailsDir, "table"));
    // 存在する要素を収集（リンク生成に使用）
    collectExistingElements(ctx, featureMap);
    // 統計
    let screenCount = 0;
    let componentCount = 0;
    let actionCount = 0;
    let moduleItemCount = 0;
    let tableCount = 0;
    // モジュールの事前マージ（異なるアプリから同名モジュールがある場合）
    const mergedModulesMap = buildMergedModulesMap(featureMap);
    // 処理済みモジュールを追跡（重複生成を防ぐ）
    const generatedModules = new Set();
    // 各機能の詳細ページを生成
    for (const [featureName, feature] of Object.entries(featureMap.features)) {
        for (const screen of feature.screens) {
            generateScreenDetailPage(screen, detailsDir, projectPath, config.project.name, ctx);
            screenCount++;
        }
        for (const component of feature.components) {
            generateComponentDetailPage(component, detailsDir, projectPath, config.project.name, ctx);
            componentCount++;
        }
        for (const action of feature.actions) {
            generateActionDetailPage(action, detailsDir, projectPath, config.project.name, ctx);
            actionCount++;
        }
        // Modules (lib/ ディレクトリのモジュール) - マージされたモジュールを使用
        for (const mod of feature.modules || []) {
            const key = `${featureName}/${mod.name}`;
            if (generatedModules.has(key))
                continue;
            generatedModules.add(key);
            const merged = mergedModulesMap.get(key);
            if (merged) {
                generateModuleItemDetailPage(merged.mod, featureName, detailsDir, projectPath, config.project.name, ctx);
                moduleItemCount++;
            }
        }
        for (const table of feature.tables) {
            generateTableDetailPage(table, detailsDir, projectPath, config.project.name, ctx);
            tableCount++;
        }
    }
    // uncategorized も処理
    if (featureMap.uncategorized) {
        for (const screen of featureMap.uncategorized.screens || []) {
            generateScreenDetailPage(screen, detailsDir, projectPath, config.project.name, ctx);
            screenCount++;
        }
        for (const component of featureMap.uncategorized.components || []) {
            generateComponentDetailPage(component, detailsDir, projectPath, config.project.name, ctx);
            componentCount++;
        }
        for (const action of featureMap.uncategorized.actions || []) {
            generateActionDetailPage(action, detailsDir, projectPath, config.project.name, ctx);
            actionCount++;
        }
        for (const mod of featureMap.uncategorized.modules || []) {
            const key = `Uncategorized/${mod.name}`;
            if (generatedModules.has(key))
                continue;
            generatedModules.add(key);
            const merged = mergedModulesMap.get(key);
            if (merged) {
                generateModuleItemDetailPage(merged.mod, "Uncategorized", detailsDir, projectPath, config.project.name, ctx);
                moduleItemCount++;
            }
        }
        for (const table of featureMap.uncategorized.tables || []) {
            generateTableDetailPage(table, detailsDir, projectPath, config.project.name, ctx);
            tableCount++;
        }
    }
    // モジュール詳細ページの生成
    const modulePageCount = generateModulePages(ctx, featureMap, detailsDir, config.project.name);
    // details.json 出力
    const detailsJson = {
        details: ctx.detailsJsonItems,
        generatedAt: new Date().toISOString(),
    };
    const detailsJsonPath = resolve(portalDir, "details.json");
    writeFile(detailsJsonPath, JSON.stringify(detailsJson, null, 2));
    logger.info(`  details.json: ${Object.keys(ctx.detailsJsonItems).length} items`);
    logger.success(t("commands.details.detailsGenerationComplete"));
    logger.info(`  Screens: ${screenCount}`);
    logger.info(`  Components: ${componentCount}`);
    logger.info(`  Actions: ${actionCount}`);
    logger.info(`  Modules: ${moduleItemCount}`);
    logger.info(`  Tables: ${tableCount}`);
    logger.info(`  Module Pages: ${modulePageCount}`);
    logger.success(t("commands.details.outputDir", { path: detailsDir }));
    return 0;
}
// ===== Internal helpers =====
/**
 * 存在する要素を収集してコンテキストに登録
 */
function collectExistingElements(ctx, featureMap) {
    const collect = (feature) => {
        feature.screens.forEach((s) => {
            const module = extractModuleName(s.path);
            const fullKey = getElementFullKey(module, s.name);
            ctx.existingElements.screens.set(fullKey, module);
        });
        feature.components.forEach((c) => {
            const module = extractModuleName(c.path);
            const fullKey = getElementFullKey(module, c.name);
            ctx.existingElements.components.set(fullKey, module);
        });
        feature.actions.forEach((a) => {
            const module = extractModuleName(a.path);
            const fullKey = getElementFullKey(module, a.name);
            ctx.existingElements.actions.set(fullKey, module);
        });
        (feature.modules || []).forEach((m) => {
            const module = extractModuleName(m.path);
            const fullKey = getElementFullKey(module, m.name);
            ctx.existingElements.modules.set(fullKey, module);
        });
        feature.tables.forEach((t) => {
            const module = extractModuleName(t.path);
            const fullKey = getElementFullKey(module, t.name);
            ctx.existingElements.tables.set(fullKey, module);
        });
    };
    for (const feature of Object.values(featureMap.features)) {
        collect(feature);
    }
    if (featureMap.uncategorized) {
        collect(featureMap.uncategorized);
    }
}
/**
 * モジュールの事前マージマップを構築
 */
function buildMergedModulesMap(featureMap) {
    const mergedMap = new Map();
    const mergeModuleRelated = (existing, newMod) => ({
        ...existing,
        usedInScreens: [...new Set([...(existing.usedInScreens || []), ...(newMod.usedInScreens || [])])],
        usedInComponents: [...new Set([...(existing.usedInComponents || []), ...(newMod.usedInComponents || [])])],
        usedInActions: [...new Set([...(existing.usedInActions || []), ...(newMod.usedInActions || [])])],
        usedInMiddleware: [...new Set([...(existing.usedInMiddleware || []), ...(newMod.usedInMiddleware || [])])],
        usedInLayouts: [...new Set([...(existing.usedInLayouts || []), ...(newMod.usedInLayouts || [])])],
        usedModules: [...new Set([...(existing.usedModules || []), ...(newMod.usedModules || [])])],
        usedInModules: [...new Set([...(existing.usedInModules || []), ...(newMod.usedInModules || [])])],
    });
    for (const [featureName, feature] of Object.entries(featureMap.features)) {
        for (const mod of feature.modules || []) {
            const key = `${featureName}/${mod.name}`;
            const existing = mergedMap.get(key);
            if (existing) {
                mergedMap.set(key, { mod: mergeModuleRelated(existing.mod, mod), featureName });
            }
            else {
                mergedMap.set(key, { mod, featureName });
            }
        }
    }
    if (featureMap.uncategorized) {
        for (const mod of featureMap.uncategorized.modules || []) {
            const key = `Uncategorized/${mod.name}`;
            const existing = mergedMap.get(key);
            if (existing) {
                mergedMap.set(key, { mod: mergeModuleRelated(existing.mod, mod), featureName: "Uncategorized" });
            }
            else {
                mergedMap.set(key, { mod, featureName: "Uncategorized" });
            }
        }
    }
    return mergedMap;
}
/**
 * モジュール概要ページを生成
 */
function generateModulePages(ctx, featureMap, detailsDir, projectName) {
    // アイテムをモジュール別にグループ化
    const moduleGroups = {
        screens: new Map(),
        components: new Map(),
        actions: new Map(),
        tables: new Map(),
    };
    const groupByModule = (items, map) => {
        for (const item of items) {
            const moduleName = extractModuleName(item.path);
            const existing = map.get(moduleName) || [];
            existing.push(item);
            map.set(moduleName, existing);
        }
    };
    // 全機能からアイテムを収集
    for (const feature of Object.values(featureMap.features)) {
        groupByModule(feature.screens, moduleGroups.screens);
        groupByModule(feature.components, moduleGroups.components);
        groupByModule(feature.actions, moduleGroups.actions);
        groupByModule(feature.tables, moduleGroups.tables);
    }
    if (featureMap.uncategorized) {
        groupByModule(featureMap.uncategorized.screens || [], moduleGroups.screens);
        groupByModule(featureMap.uncategorized.components || [], moduleGroups.components);
        groupByModule(featureMap.uncategorized.actions || [], moduleGroups.actions);
        groupByModule(featureMap.uncategorized.tables || [], moduleGroups.tables);
    }
    // モジュール説明、型定義、ユーティリティを取得
    const moduleDescriptions = featureMap.moduleDescriptions || {};
    const moduleTypes = featureMap.moduleTypes || {};
    const moduleUtilities = featureMap.moduleUtilities || {};
    let modulePageCount = 0;
    const typeModuleMap = [
        ["screen", moduleGroups.screens],
        ["component", moduleGroups.components],
        ["action", moduleGroups.actions],
        ["table", moduleGroups.tables],
    ];
    for (const [type, moduleMap] of typeModuleMap) {
        for (const [moduleName, items] of moduleMap) {
            generateModuleDetailPage({
                type: type,
                moduleName,
                moduleDescription: moduleDescriptions[moduleName],
                items,
                types: moduleTypes[moduleName],
                utilities: moduleUtilities[moduleName],
                testCases: findTestCasesForModule(moduleName, type, ctx),
                projectName,
            }, detailsDir);
            modulePageCount++;
        }
    }
    return modulePageCount;
}
//# sourceMappingURL=details.js.map