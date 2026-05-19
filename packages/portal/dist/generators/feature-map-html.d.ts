/**
 * feature-map HTML ジェネレーター
 *
 * FeatureMap データから HTML ページを生成する。
 * メインリストレイアウト、サイドバービュー、カード/リストアイテムを構築。
 */
import type { ScreenItem, ComponentItem, ActionItem, TableItem, FeatureGroup, FeatureMap, ResolvedFeatureMapConfig } from "../commands/feature-map-types.js";
/**
 * アイテムをモジュール別にグループ化
 */
export declare function groupByModule<T extends {
    path: string;
}>(items: T[]): Map<string, T[]>;
/**
 * モジュール別リストセクションを生成
 */
export declare function buildModuleListSection(type: 'screen' | 'component' | 'action' | 'table', groupedItems: Map<string, (ScreenItem | ComponentItem | ActionItem | TableItem)[]>, moduleDescriptions?: Map<string, string>): string;
/**
 * リストアイテムを生成
 */
export declare function buildListItem(type: 'screen' | 'component' | 'action' | 'table', item: ScreenItem | ComponentItem | ActionItem | TableItem, moduleName: string): string;
/**
 * Feature Map HTML を生成 (Module-grouped List レイアウト)
 */
export declare function generateFeatureMapHtml(featureMap: FeatureMap, projectName: string, config: ResolvedFeatureMapConfig, moduleDescriptions?: Map<string, string>): string;
/**
 * サイドバー HTML を構築
 */
export declare function buildSidebar(featureMap: FeatureMap): string;
/**
 * レイヤー別サイドバービューを構築
 */
export declare function buildLayerView(featureMap: FeatureMap): string;
/**
 * 機能別サイドバービューを構築
 */
export declare function buildFeatureView(featureMap: FeatureMap): string;
/**
 * 詳細パネルのHTMLデータを構築
 */
export declare function buildDetailPanel(featureMap: FeatureMap): string;
/**
 * Feature詳細を構築
 */
export declare function buildFeatureDetail(name: string, group: FeatureGroup, _featureMap: FeatureMap): string;
/**
 * Screen詳細カードを構築
 */
export declare function buildScreenCard(screen: ScreenItem): string;
/**
 * Component詳細カードを構築
 */
export declare function buildComponentCard(comp: ComponentItem): string;
/**
 * Action詳細カードを構築
 */
export declare function buildActionCard(action: ActionItem): string;
/**
 * Table詳細カードを構築
 */
export declare function buildTableCard(table: TableItem): string;
/**
 * サマリーカード HTML を生成
 */
export declare function buildSummaryCard(featureMap: FeatureMap): string;
//# sourceMappingURL=feature-map-html.d.ts.map