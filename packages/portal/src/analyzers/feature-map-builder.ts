/**
 * feature-map ビルダー
 *
 * 解析済みの FeatureMapItem 配列から FeatureMap 構造体を構築する。
 * アイテムをフィーチャー別にグループ化し、適切な型に変換する。
 */

import type { AppName } from "../utils/app-inference.js";
import type {
  ScreenItem,
  ComponentItem,
  ActionItem,
  TableItem,
  ModuleItem,
  FeatureGroup,
  TypeItem,
  UtilityItem,
  FeatureMap,
  FeatureMapItem,
} from "../commands/feature-map-types.js";

/**
 * Feature Map を構築
 */
export function buildFeatureMap(
  items: FeatureMapItem[],
  moduleDescriptions: Map<string, string> = new Map(),
  moduleTypes: Map<string, TypeItem[]> = new Map(),
  moduleUtilities: Map<string, UtilityItem[]> = new Map()
): FeatureMap {
  const features: FeatureMap["features"] = {};
  const uncategorized: FeatureGroup = {
    screens: [],
    components: [],
    actions: [],
    modules: [],
    tables: [],
  };

  // 検出されたアプリを収集
  const detectedApps = new Set<AppName>();

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
    } else {
      // Uncategorized に追加
      addToGroup(uncategorized, item.type, converted);
    }
  }

  // Map を Record に変換
  const moduleDescriptionsRecord: Record<string, string> = {};
  for (const [key, value] of moduleDescriptions) {
    moduleDescriptionsRecord[key] = value;
  }

  // moduleTypes を Record に変換
  const moduleTypesRecord: Record<string, TypeItem[]> = {};
  for (const [key, value] of moduleTypes) {
    moduleTypesRecord[key] = value;
  }

  // moduleUtilities を Record に変換
  const moduleUtilitiesRecord: Record<string, UtilityItem[]> = {};
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
export function convertItem(
  item: FeatureMapItem
): ScreenItem | ComponentItem | ActionItem | ModuleItem | TableItem {
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
      } as ScreenItem;

    case "component":
      return {
        name: item.name,
        path: item.path,
        description: item.description,
        usedInScreens: item.usedInScreens || [],
        usedInComponents: item.usedInComponents || [],
        usedActions: item.usedActions || [],
        app: item.app,
      } as ComponentItem;

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
      } as ActionItem;

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
      } as ModuleItem;

    case "table":
      return {
        name: item.name,
        path: item.path,
        description: item.description,
        usedInActions: item.usedInActions || [],
        app: item.app,
      } as TableItem;
  }
}

/**
 * グループにアイテムを追加
 */
export function addToGroup(
  group: FeatureGroup,
  type: FeatureMapItem["type"],
  item: ScreenItem | ComponentItem | ActionItem | ModuleItem | TableItem
): void {
  switch (type) {
    case "screen":
      group.screens.push(item as ScreenItem);
      break;
    case "component":
      group.components.push(item as ComponentItem);
      break;
    case "action":
      group.actions.push(item as ActionItem);
      break;
    case "module":
      group.modules.push(item as ModuleItem);
      break;
    case "table":
      group.tables.push(item as TableItem);
      break;
  }
}
