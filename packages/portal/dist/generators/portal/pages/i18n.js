/**
 * i18n ページジェネレーター
 */
import { renderTemplate } from "../renderer.js";
/**
 * i18n 一覧ページの HTML を生成する
 */
export function generateI18nPage(data) {
    if (!data.i18n) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: "i18n",
            message: "i18n.json が見つかりません。",
        });
    }
    const { i18n } = data;
    return renderTemplate("pages/i18n.html.hbs", {
        projectName: data.projectName,
        locales: i18n.locales,
        primaryLocale: i18n.primaryLocale,
        apps: i18n.apps,
        namespaces: i18n.namespaces.map((ns) => ({
            ...ns,
            coveragePercent: ns.stats.totalKeys > 0
                ? Math.round((ns.stats.fullyTranslatedKeys / ns.stats.totalKeys) * 100)
                : 0,
        })),
        stats: i18n.stats,
        generatedAt: i18n.generatedAt,
    });
}
/**
 * i18n 名前空間詳細ページの HTML を生成する
 */
export function generateI18nNamespacePage(data, namespaceName) {
    if (!data.i18n) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: "i18n",
            message: "i18n.json が見つかりません。",
        });
    }
    const decoded = decodeURIComponent(namespaceName);
    const namespace = data.i18n.namespaces.find((ns) => ns.name === decoded || ns.name === namespaceName);
    if (!namespace) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: "i18n 名前空間",
            message: `名前空間「${decoded}」が見つかりません。`,
        });
    }
    const coveragePercent = namespace.stats.totalKeys > 0
        ? Math.round((namespace.stats.fullyTranslatedKeys / namespace.stats.totalKeys) * 100)
        : 0;
    return renderTemplate("pages/i18n-namespace.html.hbs", {
        projectName: data.projectName,
        namespace,
        locales: data.i18n.locales,
        coveragePercent,
    });
}
//# sourceMappingURL=i18n.js.map