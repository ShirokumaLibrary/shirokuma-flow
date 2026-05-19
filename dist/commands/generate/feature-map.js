/**
 * feature-map コマンド - 機能階層マップ生成
 *
 * TypeScript ファイルからカスタム JSDoc タグを解析し、
 * 5層の階層的な機能マップを生成する
 *
 * 対象タグ:
 * - @screen ScreenName - 画面/ページ識別子
 * - @component ComponentName - コンポーネント識別子
 * - @serverAction - Server Action マーカー
 * - @module moduleName - lib/ モジュール識別子 (auth, security, content等)
 * - @dbTable tableName - データベーステーブル参照
 * - @feature FeatureName - 機能グループ
 * - @route /path - URL ルート
 * - @usedComponents Comp1, Comp2 - 使用コンポーネント
 * - @usedActions action1, action2 - 使用アクション
 * - @usedInScreen ScreenName - 親画面
 * - @usedInComponent CompName - 親コンポーネント
 * - @dbTables table1, table2 - 使用データベーステーブル
 */
import { resolve, relative } from "node:path";
import { loadConfig, getOutputPath } from "../../utils/config.js";
import { ensureDir, writeFile, readFile } from "../../utils/file.js";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
import { analyzeProjectReferences } from "../../analyzers/reference-analyzer.js";
import { extractModuleName } from "../../parsers/feature-map-utils.js";
import { parseFeatureMapTagsWithMetadata } from "../../parsers/feature-map-tags.js";
import { mergeInferredReferences, buildTableReverseReferences, buildModuleReferences } from "../../analyzers/feature-map-references.js";
import { buildFeatureMap } from "../../analyzers/feature-map-builder.js";
import { generateFeatureMapHtml } from "../../generators/feature-map-html.js";
import { resolveFeatureMapConfig, collectFiles } from "../../generators/feature-map-styles.js";
// ============================================================
// Command Handler
// ============================================================
/**
 * feature-map コマンドハンドラ
 */
export function featureMapCommand(options) {
    const logger = createLogger(options.verbose);
    const projectPath = resolve(options.project);
    logger.info(t("commands.featureMap.generating"));
    // 設定読み込み
    const config = loadConfig(projectPath, options.config);
    const featureMapConfig = resolveFeatureMapConfig(config.featureMap);
    // ファイルを収集
    const files = collectFiles(projectPath, featureMapConfig);
    logger.debug(`対象ファイル数: ${files.length}`);
    // 各ファイルを解析（モジュール説明・型定義・ユーティリティも収集）
    const allItems = [];
    const moduleDescriptions = new Map();
    const moduleTypes = new Map();
    const moduleUtilities = new Map();
    for (const file of files) {
        const content = readFile(file);
        if (!content)
            continue;
        const relativePath = relative(projectPath, file);
        const { items, metadata, types, utilities } = parseFeatureMapTagsWithMetadata(content, relativePath);
        allItems.push(...items);
        const moduleName = extractModuleName(relativePath);
        // モジュール説明を収集（各ファイルのヘッダーから）
        if (metadata.moduleDescription) {
            const existingDesc = moduleDescriptions.get(moduleName);
            if (!existingDesc || metadata.moduleDescription.length > existingDesc.length) {
                moduleDescriptions.set(moduleName, metadata.moduleDescription);
            }
        }
        // 型定義を収集（モジュール別）
        if (types.length > 0) {
            const existingTypes = moduleTypes.get(moduleName) || [];
            for (const type of types) {
                if (!existingTypes.some(t => t.name === type.name)) {
                    existingTypes.push(type);
                }
            }
            moduleTypes.set(moduleName, existingTypes);
        }
        // ユーティリティを収集（モジュール別）
        if (utilities.length > 0) {
            const existingUtilities = moduleUtilities.get(moduleName) || [];
            for (const util of utilities) {
                if (!existingUtilities.some(u => u.name === util.name)) {
                    existingUtilities.push(util);
                }
            }
            moduleUtilities.set(moduleName, existingUtilities);
        }
    }
    logger.debug(`抽出アイテム数: ${allItems.length}`);
    logger.debug(`モジュール説明数: ${moduleDescriptions.size}`);
    logger.debug(`型定義モジュール数: ${moduleTypes.size}`);
    logger.debug(`ユーティリティモジュール数: ${moduleUtilities.size}`);
    // ts-morph による自動参照解析
    logger.info(t("commands.featureMap.analyzingReferences"));
    const tsxFiles = files.filter(f => f.endsWith(".tsx") || f.endsWith(".ts"));
    const referenceResult = analyzeProjectReferences({
        projectPath,
        targetFiles: tsxFiles,
        verbose: options.verbose,
    });
    logger.info(`参照解析完了: ${referenceResult.fileUsages.size} ファイルで参照を検出`);
    // 解析結果を allItems にマージ
    mergeInferredReferences(allItems, referenceResult, projectPath);
    // Action → Table 逆参照を構築（Table.usedInActions を設定）
    buildTableReverseReferences(allItems);
    // Module → Module 双方向関連を構築
    buildModuleReferences(allItems, referenceResult, projectPath);
    // Feature Map を構築
    const featureMap = buildFeatureMap(allItems, moduleDescriptions, moduleTypes, moduleUtilities);
    // 検出されたアプリを表示
    if (featureMap.apps && featureMap.apps.length > 0) {
        logger.info(`検出されたアプリ: ${featureMap.apps.join(", ")}`);
    }
    // 出力先
    const portalDir = options.output
        ? resolve(options.output)
        : getOutputPath(config, projectPath, "portal");
    ensureDir(portalDir);
    // HTML 出力
    const htmlPath = resolve(portalDir, "feature-map.html");
    const moduleDescMap = new Map(Object.entries(featureMap.moduleDescriptions));
    const htmlContent = generateFeatureMapHtml(featureMap, config.project.name, featureMapConfig, moduleDescMap);
    writeFile(htmlPath, htmlContent);
    logger.success(`HTML: ${htmlPath}`);
    // JSON 出力
    const jsonPath = resolve(portalDir, "feature-map.json");
    writeFile(jsonPath, JSON.stringify(featureMap, null, 2));
    logger.success(`JSON: ${jsonPath}`);
    logger.success(t("commands.featureMap.done"));
    return 0;
}
//# sourceMappingURL=feature-map.js.map