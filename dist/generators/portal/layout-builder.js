/**
 * レイアウトビルダー
 *
 * ページコンテンツを共通レイアウト（ヘッダー + サイドバー + コンテンツ）でラップする。
 */
import Handlebars from "handlebars";
import { renderTemplate } from "./renderer.js";
/**
 * ページコンテンツを共通レイアウトでラップする
 */
export function wrapWithLayout(options) {
    return renderTemplate("_layout.html.hbs", {
        title: options.title,
        projectName: options.projectName,
        sidebarSections: options.sidebarSections,
        content: new Handlebars.SafeString(options.content),
        breadcrumbs: options.breadcrumbs || [],
        bodyClass: options.bodyClass || "",
        extraScripts: options.extraScripts
            ? new Handlebars.SafeString(options.extraScripts)
            : "",
        currentPath: options.currentPath || "/",
    });
}
//# sourceMappingURL=layout-builder.js.map