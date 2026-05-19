/**
 * 機能マップページジェネレーター
 */
import { renderTemplate } from "../renderer.js";
/**
 * 機能マップページの HTML を生成する
 */
export function generateFeatureMapPage(data) {
    if (!data.featureMap) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: "機能マップ",
            message: "feature-map.json が見つかりません。",
        });
    }
    const modules = Object.entries(data.featureMap.features).map(([name, group]) => ({
        name,
        description: data.featureMap.moduleDescriptions?.[name] || "",
        screenCount: group.screens?.length || 0,
        componentCount: group.components?.length || 0,
        actionCount: group.actions?.length || 0,
        tableCount: group.tables?.length || 0,
        screens: group.screens || [],
        components: group.components || [],
        actions: group.actions || [],
        tables: group.tables || [],
    }));
    // 未分類グループ
    const uncategorized = data.featureMap.uncategorized;
    const hasUncategorized = (uncategorized.screens?.length || 0) +
        (uncategorized.components?.length || 0) +
        (uncategorized.actions?.length || 0) >
        0;
    const totalItems = modules.reduce((sum, m) => sum + m.screenCount + m.componentCount + m.actionCount + m.tableCount, 0);
    return renderTemplate("pages/feature-map.html.hbs", {
        projectName: data.projectName,
        modules,
        hasUncategorized,
        uncategorized: hasUncategorized ? uncategorized : null,
        totalModules: modules.length,
        totalItems,
        generatedAt: data.featureMap.generatedAt,
    });
}
/**
 * アプリ固有機能マップページの HTML を生成する
 */
export function generateFeatureMapAppPage(data, appId) {
    if (!data.featureMap) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: "機能マップ",
            message: "feature-map.json が見つかりません。",
        });
    }
    const app = data.applications?.apps.find((a) => a.id === appId);
    if (!app) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: `アプリ: ${appId}`,
            message: `アプリ「${appId}」が見つかりません。`,
        });
    }
    // アプリに属する機能のみフィルタリング
    const modules = Object.entries(data.featureMap.features)
        .map(([name, group]) => ({
        name,
        description: data.featureMap.moduleDescriptions?.[name] || "",
        screens: (group.screens || []).filter((s) => !s.app || s.app.toLowerCase() === appId.toLowerCase() || s.app === "Shared"),
        components: (group.components || []).filter((c) => !c.app || c.app.toLowerCase() === appId.toLowerCase() || c.app === "Shared"),
        actions: (group.actions || []).filter((a) => !a.app || a.app.toLowerCase() === appId.toLowerCase() || a.app === "Shared"),
        tables: group.tables || [],
    }))
        .filter((m) => m.screens.length + m.components.length + m.actions.length > 0)
        .map((m) => ({
        ...m,
        screenCount: m.screens.length,
        componentCount: m.components.length,
        actionCount: m.actions.length,
        tableCount: m.tables.length,
    }));
    return renderTemplate("pages/feature-map-app.html.hbs", {
        projectName: data.projectName,
        app,
        modules,
        totalModules: modules.length,
        appId,
    });
}
//# sourceMappingURL=feature-map.js.map