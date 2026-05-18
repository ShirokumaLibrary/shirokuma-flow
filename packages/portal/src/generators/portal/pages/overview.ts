/**
 * 概要ページ（Overview）ジェネレーター
 *
 * overview.md の内容を marked.js CDN でクライアントサイドレンダリングする。
 */

import { renderTemplate } from "../renderer.js";
import type { PortalData } from "../types.js";

/**
 * 概要ページの HTML を生成する
 */
export function generateOverviewPage(data: PortalData): string {
  const markdownContent = data.overview?.content ?? "";

  return renderTemplate("pages/overview.html.hbs", {
    projectName: data.projectName,
    markdownContent: JSON.stringify(markdownContent).replace(/</g, "\\u003c"),
  });
}
