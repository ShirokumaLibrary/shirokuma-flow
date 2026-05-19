/**
 * feature-map ビルダー
 *
 * 解析済みの FeatureMapItem 配列から FeatureMap 構造体を構築する。
 * アイテムをフィーチャー別にグループ化し、適切な型に変換する。
 */
/**
 * Feature Map を構築
 */
export function buildFeatureMap(items, moduleDescriptions = new Map(), moduleTypes = new Map(), moduleUtilities = new Map()) {
    const features = {};
    const uncategorized = {
        screens: [],
        components: [],
        actions: [],
        modules: [],
        tables: [],
    };
    // 検出されたアプリを収集
    const detectedApps = new Set();
    for (const item of items) {
        // アイテムを適切な構造に変換
        const converted = convertItem(item);
        // アプリ名を収集
        if (item.app && item.app !== "Unknown") {
            detectedApps.add(item.app);
        }
        if (item.feature) {
            // Feature グループに追加
            if (!features[item.feature]) {
                features[item.feature] = {
                    screens: [],
                    components: [],
                    actions: [],
                    modules: [],
                    tables: [],
                };
            }
            addToGroup(features[item.feature], item.type, converted);
        }
        else {
            // Uncategorized に追加
            addToGroup(uncategorized, item.type, converted);
        }
    }
    // Map を Record に変換
    const moduleDescriptionsRecord = {};
    for (const [key, value] of moduleDescriptions) {
        moduleDescriptionsRecord[key] = value;
    }
    // moduleTypes を Record に変換
    const moduleTypesRecord = {};
    for (const [key, value] of moduleTypes) {
        moduleTypesRecord[key] = value;
    }
    // moduleUtilities を Record に変換
    const moduleUtilitiesRecord = {};
    for (const [key, value] of moduleUtilities) {
        moduleUtilitiesRecord[key] = value;
    }
    return {
        features,
        uncategorized,
        moduleDescriptions: moduleDescriptionsRecord,
        moduleTypes: moduleTypesRecord,
        moduleUtilities: moduleUtilitiesRecord,
        apps: Array.from(detectedApps).sort(),
        generatedAt: new Date().toISOString(),
    };
}
/**
 * アイテムを適切な構造に変換
 */
export function convertItem(item) {
    switch (item.type) {
        case "screen":
            return {
                name: item.name,
                path: item.path,
                route: item.route,
                description: item.description,
                usedComponents: item.usedComponents || [],
                usedActions: item.usedActions || [],
                app: item.app,
            };
        case "component":
            return {
                name: item.name,
                path: item.path,
                description: item.description,
                usedInScreens: item.usedInScreens || [],
                usedInComponents: item.usedInComponents || [],
                usedActions: item.usedActions || [],
                app: item.app,
            };
        case "action":
            return {
                name: item.name,
                path: item.path,
                description: item.description,
                usedInScreens: item.usedInScreens || [],
                usedInComponents: item.usedInComponents || [],
                dbTables: item.dbTables || [],
                app: item.app,
                actionType: item.actionType,
            };
        case "module":
            return {
                name: item.name,
                path: item.path,
                description: item.description,
                usedInScreens: item.usedInScreens || [],
                usedInComponents: item.usedInComponents || [],
                usedInActions: item.usedInActions || [],
                usedInMiddleware: item.usedInMiddleware || [],
                usedInLayouts: item.usedInLayouts || [],
                usedModules: item.usedModules || [],
                usedInModules: item.usedInModules || [],
                app: item.app,
                category: item.category,
            };
        case "table":
            return {
                name: item.name,
                path: item.path,
                description: item.description,
                usedInActions: item.usedInActions || [],
                app: item.app,
            };
    }
}
/**
 * グループにアイテムを追加
 */
export function addToGroup(group, type, item) {
    switch (type) {
        case "screen":
            group.screens.push(item);
            break;
        case "component":
            group.components.push(item);
            break;
        case "action":
            group.actions.push(item);
            break;
        case "module":
            group.modules.push(item);
            break;
        case "table":
            group.tables.push(item);
            break;
    }
}
//# sourceMappingURL=feature-map-builder.js.map