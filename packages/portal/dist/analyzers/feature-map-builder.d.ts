/**
 * feature-map ビルダー
 *
 * 解析済みの FeatureMapItem 配列から FeatureMap 構造体を構築する。
 * アイテムをフィーチャー別にグループ化し、適切な型に変換する。
 */
import type { ScreenItem, ComponentItem, ActionItem, TableItem, ModuleItem, FeatureGroup, TypeItem, UtilityItem, FeatureMap, FeatureMapItem } from "../commands/feature-map-types.js";
/**
 * Feature Map を構築
 */
export declare function buildFeatureMap(items: FeatureMapItem[], moduleDescriptions?: Map<string, string>, moduleTypes?: Map<string, TypeItem[]>, moduleUtilities?: Map<string, UtilityItem[]>): FeatureMap;
/**
 * アイテムを適切な構造に変換
 */
export declare function convertItem(item: FeatureMapItem): ScreenItem | ComponentItem | ActionItem | ModuleItem | TableItem;
/**
 * グループにアイテムを追加
 */
export declare function addToGroup(group: FeatureGroup, type: FeatureMapItem["type"], item: ScreenItem | ComponentItem | ActionItem | ModuleItem | TableItem): void;
//# sourceMappingURL=feature-map-builder.d.ts.map