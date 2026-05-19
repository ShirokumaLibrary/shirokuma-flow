/**
 * パッケージページジェネレーター
 */
import { renderTemplate } from "../renderer.js";
/**
 * パッケージ一覧ページの HTML を生成する
 */
export function generatePackagesPage(data) {
    if (!data.packages) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: "パッケージ",
            message: "packages.json が見つかりません。",
        });
    }
    const { packages } = data;
    return renderTemplate("pages/packages.html.hbs", {
        projectName: data.projectName,
        packages: packages.packages,
        summary: packages.summary,
        generatedAt: packages.generatedAt,
    });
}
/**
 * パッケージ詳細ページの HTML を生成する
 */
export function generatePackageDetailPage(data, packageId) {
    if (!data.packages) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: "パッケージ詳細",
            message: "packages.json が見つかりません。",
        });
    }
    const decoded = decodeURIComponent(packageId);
    const pkg = data.packages.packages.find((p) => p.name === decoded || p.name === packageId);
    if (!pkg) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: "パッケージ詳細",
            message: `パッケージ「${decoded}」が見つかりません。`,
        });
    }
    return renderTemplate("pages/packages-detail.html.hbs", {
        projectName: data.projectName,
        package: pkg,
    });
}
//# sourceMappingURL=packages.js.map