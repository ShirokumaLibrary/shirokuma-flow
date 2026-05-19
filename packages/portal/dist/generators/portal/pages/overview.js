/**
 * 概要ページ（Overview）ジェネレーター
 *
 * overview.md の内容を marked.js CDN でクライアントサイドレンダリングする。
 */
import { renderTemplate } from "../renderer.js";
/**
 * 概要ページの HTML を生成する
 */
export function generateOverviewPage(data) {
    const markdownContent = data.overview?.content ?? "";
    return renderTemplate("pages/overview.html.hbs", {
        projectName: data.projectName,
        markdownContent: JSON.stringify(markdownContent).replace(/</g, "\\u003c"),
    });
}
//# sourceMappingURL=overview.js.map