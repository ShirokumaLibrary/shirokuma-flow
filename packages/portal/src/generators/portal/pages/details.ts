/**
 * 詳細ページジェネレーター
 */

import { renderTemplate } from "../renderer.js";
import type { PortalData } from "../types.js";

/** 詳細ページのアイテムタイプ */
export type DetailType = "screen" | "component" | "action" | "module" | "table";

/**
 * 詳細一覧ページ（type/module）の HTML を生成する
 */
export function generateDetailsModulePage(
  data: PortalData,
  type: DetailType,
  moduleName: string
): string {
  if (!data.featureMap) {
    return renderTemplate("pages/empty-state.html.hbs", {
      title: "詳細",
      message: "feature-map.json が見つかりません。",
    });
  }

  const decodedModule = decodeURIComponent(moduleName);
  const group =
    data.featureMap.features[decodedModule] ||
    (decodedModule === "Uncategorized"
      ? data.featureMap.uncategorized
      : null);

  if (!group) {
    return renderTemplate("pages/empty-state.html.hbs", {
      title: "詳細",
      message: `モジュール「${decodedModule}」が見つかりません。`,
    });
  }

  const items = getItemsByType(group, type);
  const typeLabel = getTypeLabel(type);

  return renderTemplate("pages/details-module.html.hbs", {
    projectName: data.projectName,
    type,
    typeLabel,
    moduleName: decodedModule,
    items: items.map((item) => ({
      ...item,
      detailPath: `/details/${type}/${encodeURIComponent(decodedModule)}/${encodeURIComponent(item.name)}`,
    })),
    totalItems: items.length,
  });
}

/**
 * 詳細アイテムページの HTML を生成する
 */
export function generateDetailsItemPage(
  data: PortalData,
  type: DetailType,
  moduleName: string,
  itemName: string
): string {
  const decodedModule = decodeURIComponent(moduleName);
  const decodedItem = decodeURIComponent(itemName);

  // details.json から詳細データを探す
  let detailItem = null;
  if (data.details) {
    const key = `${type}/${decodedModule}/${decodedItem}`;
    detailItem = data.details.details[key] || null;

    // feature map のファイルモジュール名で再試行
    if (!detailItem) {
      for (const [k, v] of Object.entries(data.details.details)) {
        const parts = k.split("/");
        if (
          parts[0] === type &&
          parts[2] === decodedItem
        ) {
          detailItem = v;
          break;
        }
      }
    }
  }

  // feature map からの基本情報
  let baseItem: { name: string; description?: string; path?: string } | null =
    null;
  if (data.featureMap) {
    const group =
      data.featureMap.features[decodedModule] ||
      (decodedModule === "Uncategorized"
        ? data.featureMap.uncategorized
        : null);
    if (group) {
      const items = getItemsByType(group, type) as Array<{
        name: string;
        description?: string;
        path?: string;
      }>;
      baseItem = items.find((i) => i.name === decodedItem) || null;
    }
  }

  if (!detailItem && !baseItem) {
    return renderTemplate("pages/empty-state.html.hbs", {
      title: "詳細",
      message: `アイテム「${decodedItem}」が見つかりません。`,
    });
  }

  const typeLabel = getTypeLabel(type);

  return renderTemplate("pages/details-item.html.hbs", {
    projectName: data.projectName,
    type,
    typeLabel,
    moduleName: decodedModule,
    itemName: decodedItem,
    detailItem,
    baseItem,
    hasDetail: detailItem !== null,
  });
}

// === 内部ユーティリティ ===

export function getItemsByType(
  group: {
    screens: Array<{ name: string; description?: string; path?: string }>;
    components: Array<{ name: string; description?: string; path?: string }>;
    actions: Array<{ name: string; description?: string; path?: string }>;
    tables: Array<{ name: string; description?: string }>;
    modules: Array<{ name: string; description?: string; path?: string }>;
  },
  type: DetailType
): Array<{ name: string; description?: string; path?: string }> {
  switch (type) {
    case "screen":
      return group.screens || [];
    case "component":
      return group.components || [];
    case "action":
      return group.actions || [];
    case "table":
      return group.tables || [];
    case "module":
      return group.modules || [];
    default:
      return [];
  }
}

function getTypeLabel(type: DetailType): string {
  const labels: Record<DetailType, string> = {
    screen: "画面",
    component: "コンポーネント",
    action: "アクション",
    module: "モジュール",
    table: "テーブル",
  };
  return labels[type] || type;
}
