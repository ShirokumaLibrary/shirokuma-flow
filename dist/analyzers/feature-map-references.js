/**
 * feature-map 参照解析・マージ
 *
 * ts-morph による自動参照解析結果を FeatureMapItem にマージし、
 * 逆参照（Action→Table, Module→Module）を構築する。
 */
import { isMiddlewareFile, isLayoutFile, } from "./reference-analyzer.js";
/**
 * 自動解析で推論した参照情報を allItems にマージする
 *
 * マージ戦略: アノテーション ∪ 自動検出（重複排除）
 *
 * @param allItems - 既存のアイテム配列（mutate）
 * @param referenceResult - ts-morph による参照解析結果
 * @param projectPath - プロジェクトルートパス
 */
export function mergeInferredReferences(allItems, referenceResult, _projectPath) {
    const { fileUsages, reverseRefs } = referenceResult;
    // ファイルパス → アイテムのインデックスを構築
    const pathToItem = new Map();
    for (const item of allItems) {
        pathToItem.set(item.path, item);
    }
    // 1. fileUsages から直接参照をマージ (Screen/Component → usedComponents/usedActions)
    for (const [filePath, usage] of fileUsages) {
        const item = pathToItem.get(filePath);
        if (!item)
            continue;
        if (item.type === "screen") {
            // Screen: usedComponents, usedActions をマージ
            item.usedComponents = mergeArrays(item.usedComponents || [], usage.usedComponents);
            item.usedActions = mergeArrays(item.usedActions || [], usage.usedActions);
        }
        else if (item.type === "component") {
            // Component: usedActions をマージ
            item.usedActions = mergeArrays(item.usedActions || [], usage.usedActions);
        }
    }
    // 2. reverseRefs から逆参照をマージ (Component/Action → usedInScreens/usedInComponents)
    // コンポーネントの逆参照（どの Screen/Component から使われているか）
    for (const [componentName, usingFiles] of reverseRefs.componentToFiles) {
        // componentName を持つアイテムを探す
        const componentItem = allItems.find(item => item.type === "component" && item.name === componentName);
        if (!componentItem)
            continue;
        // 使用元を Screen と Component に分類
        const screenNames = [];
        const componentNames = [];
        for (const usingFile of usingFiles) {
            const usingItem = pathToItem.get(usingFile);
            if (!usingItem)
                continue;
            if (usingItem.type === "screen") {
                screenNames.push(usingItem.name);
            }
            else if (usingItem.type === "component" && usingItem.name !== componentName) {
                // 自己参照は除外
                componentNames.push(usingItem.name);
            }
        }
        componentItem.usedInScreens = mergeArrays(componentItem.usedInScreens || [], screenNames);
        componentItem.usedInComponents = mergeArrays(componentItem.usedInComponents || [], componentNames);
    }
    // アクションの逆参照（どの Screen/Component から使われているか）
    for (const [actionName, usingFiles] of reverseRefs.actionToFiles) {
        // actionName を持つアイテムを探す
        const actionItem = allItems.find(item => item.type === "action" && item.name === actionName);
        if (!actionItem)
            continue;
        const screenNames = [];
        const componentNames = [];
        for (const usingFile of usingFiles) {
            const usingItem = pathToItem.get(usingFile);
            if (!usingItem)
                continue;
            if (usingItem.type === "screen") {
                screenNames.push(usingItem.name);
            }
            else if (usingItem.type === "component") {
                componentNames.push(usingItem.name);
            }
        }
        actionItem.usedInScreens = mergeArrays(actionItem.usedInScreens || [], screenNames);
        actionItem.usedInComponents = mergeArrays(actionItem.usedInComponents || [], componentNames);
    }
    // モジュールの逆参照（どの Screen/Component/Action/Middleware から使われているか）- パスベースでマッチング
    for (const [modulePath, usingFiles] of reverseRefs.modulePathToFiles) {
        const dirPrefix = modulePath.replace(/\.ts$/, "") + "/";
        const matchingModules = allItems.filter(item => item.type === "module" &&
            (item.path === modulePath || item.path.startsWith(dirPrefix)));
        if (matchingModules.length === 0)
            continue;
        const screenNames = [];
        const componentNames = [];
        const actionNames = [];
        const middlewareFiles = [];
        const layoutFiles = [];
        for (const usingFile of usingFiles) {
            // middleware.ts または layout.tsx は pathToItem にないので先にチェック
            if (isMiddlewareFile(usingFile)) {
                const appMatch = usingFile.match(/apps\/([^/]+)\/middleware/);
                const appName = appMatch ? appMatch[1].charAt(0).toUpperCase() + appMatch[1].slice(1) : "App";
                middlewareFiles.push(`${appName} Middleware`);
                continue;
            }
            if (isLayoutFile(usingFile)) {
                const appMatch = usingFile.match(/apps\/([^/]+)\//);
                const appName = appMatch ? appMatch[1].charAt(0).toUpperCase() + appMatch[1].slice(1) : "App";
                layoutFiles.push(`${appName} Layout`);
                continue;
            }
            const usingItem = pathToItem.get(usingFile);
            if (!usingItem)
                continue;
            if (usingItem.type === "screen") {
                screenNames.push(usingItem.name);
            }
            else if (usingItem.type === "component") {
                componentNames.push(usingItem.name);
            }
            else if (usingItem.type === "action") {
                actionNames.push(usingItem.name);
            }
        }
        // マッチした全モジュールに適用
        for (const moduleItem of matchingModules) {
            moduleItem.usedInScreens = mergeArrays(moduleItem.usedInScreens || [], screenNames);
            moduleItem.usedInComponents = mergeArrays(moduleItem.usedInComponents || [], componentNames);
            moduleItem.usedInActions = mergeArrays(moduleItem.usedInActions || [], actionNames);
            moduleItem.usedInMiddleware = mergeArrays(moduleItem.usedInMiddleware || [], middlewareFiles);
            moduleItem.usedInLayouts = mergeArrays(moduleItem.usedInLayouts || [], layoutFiles);
        }
    }
}
/**
 * 2つの配列をマージ（重複排除）
 */
export function mergeArrays(existing, inferred) {
    return [...new Set([...existing, ...inferred])];
}
/**
 * Action → Table の逆参照を構築
 * 各 Action の dbTables から Table の usedInActions を設定
 */
export function buildTableReverseReferences(allItems) {
    // テーブル名 → アクション名の配列
    const tableToActions = new Map();
    // 全アクションを走査して dbTables を収集
    for (const item of allItems) {
        if (item.type === "action" && item.dbTables && item.dbTables.length > 0) {
            for (const tableName of item.dbTables) {
                const normalizedTableName = tableName.trim().toLowerCase();
                const existing = tableToActions.get(normalizedTableName) || [];
                existing.push(item.name);
                tableToActions.set(normalizedTableName, existing);
            }
        }
    }
    // 全テーブルを走査して usedInActions を設定
    for (const item of allItems) {
        if (item.type === "table") {
            const normalizedTableName = item.name.trim().toLowerCase();
            const actions = tableToActions.get(normalizedTableName) || [];
            item.usedInActions = [...new Set(actions)]; // 重複排除
        }
    }
}
/**
 * Module → Module の双方向参照を構築
 * 各モジュールが使用するモジュール (usedModules) と
 * 各モジュールを使用するモジュール (usedInModules) を設定
 */
export function buildModuleReferences(allItems, referenceResult, _projectPath) {
    // パス → アイテムのマップを構築
    const pathToItem = new Map();
    for (const item of allItems) {
        if (item.type === "module") {
            pathToItem.set(item.path, item);
        }
    }
    // ディレクトリパス → 配下のモジュール一覧（ディレクトリインポート対応）
    const dirToModules = new Map();
    for (const item of allItems) {
        if (item.type === "module") {
            const dirPath = item.path.replace(/\/[^/]+\.tsx?$/, "");
            const existing = dirToModules.get(dirPath) || [];
            existing.push(item);
            dirToModules.set(dirPath, existing);
        }
    }
    // モジュール名 → モジュールアイテムのマップ
    const nameToModules = new Map();
    for (const item of allItems) {
        if (item.type === "module") {
            const existing = nameToModules.get(item.name) || [];
            existing.push(item);
            nameToModules.set(item.name, existing);
        }
    }
    // モジュール間参照を解決するヘルパー関数
    const findModulesByPath = (modulePath, sourceApp) => {
        // 1. 完全一致
        const exactMatch = pathToItem.get(modulePath);
        if (exactMatch)
            return [exactMatch];
        // 2. ディレクトリインポート対応
        const dirPath = modulePath.replace(/\.tsx?$/, "");
        const dirModules = dirToModules.get(dirPath);
        if (dirModules && dirModules.length > 0) {
            if (sourceApp) {
                const sameAppModules = dirModules.filter(m => m.app === sourceApp);
                if (sameAppModules.length > 0)
                    return sameAppModules;
            }
            return dirModules;
        }
        return [];
    };
    // fileUsages から各モジュールファイルの使用関係を取得
    for (const [filePath, usage] of referenceResult.fileUsages) {
        const sourceItem = pathToItem.get(filePath);
        if (!sourceItem || sourceItem.type !== "module")
            continue;
        const usedModuleNames = [];
        for (const modulePath of usage.usedModulePaths) {
            const targetItems = findModulesByPath(modulePath, sourceItem.app);
            for (const targetItem of targetItems) {
                if (targetItem.name !== sourceItem.name) {
                    usedModuleNames.push(targetItem.name);
                }
            }
        }
        sourceItem.usedModules = [...new Set([...(sourceItem.usedModules || []), ...usedModuleNames])];
    }
    // 逆参照を構築: 各モジュールの usedInModules を設定
    for (const item of allItems) {
        if (item.type === "module" && item.usedModules && item.usedModules.length > 0) {
            for (const usedModuleName of item.usedModules) {
                const targetModules = nameToModules.get(usedModuleName) || [];
                for (const targetModule of targetModules) {
                    if (!item.app || !targetModule.app || item.app === targetModule.app) {
                        targetModule.usedInModules = [...new Set([...(targetModule.usedInModules || []), item.name])];
                    }
                }
            }
        }
    }
}
//# sourceMappingURL=feature-map-references.js.map