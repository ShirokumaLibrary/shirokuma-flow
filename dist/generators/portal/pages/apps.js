/**
 * アプリケーションページジェネレーター
 */
import { renderTemplate } from "../renderer.js";
/**
 * アプリホームページの HTML を生成する
 */
export function generateAppsHomePage(data, appId) {
    const app = data.applications?.apps.find((a) => a.id === appId);
    if (!app) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: `アプリ: ${appId}`,
            message: `アプリ「${appId}」が見つかりません。`,
        });
    }
    // アプリ統計
    const stats = app.stats || {};
    return renderTemplate("pages/apps-home.html.hbs", {
        projectName: data.projectName,
        app,
        appId,
        stats,
        sections: app.sections || [],
        available: data.available,
    });
}
//# sourceMappingURL=apps.js.map