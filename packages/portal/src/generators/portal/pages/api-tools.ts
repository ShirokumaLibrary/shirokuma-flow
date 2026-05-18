/**
 * API ツールページジェネレーター
 */

import { renderTemplate } from "../renderer.js";
import type { PortalData } from "../types.js";

/**
 * API ツールページの HTML を生成する
 */
export function generateApiToolsPage(data: PortalData): string {
  if (!data.apiTools) {
    return renderTemplate("pages/empty-state.html.hbs", {
      title: "API ツール",
      message: "api-tools.json が見つかりません。",
    });
  }

  const { apiTools } = data;

  // カテゴリ別にツールをグループ化
  const toolsByCategory = apiTools.categories.map((cat) => ({
    ...cat,
    toolItems: apiTools.tools.filter((t) => t.category === cat.name),
  }));

  // カテゴリなしのツール
  const uncategorizedTools = apiTools.tools.filter(
    (t) =>
      !t.category ||
      !apiTools.categories.some((c) => c.name === t.category)
  );

  return renderTemplate("pages/api-tools.html.hbs", {
    projectName: data.projectName,
    name: apiTools.name || "API ツール",
    description: apiTools.description,
    protocol: apiTools.protocol || "mcp",
    toolsByCategory,
    uncategorizedTools,
    summary: apiTools.summary,
    generatedAt: apiTools.generatedAt,
  });
}
