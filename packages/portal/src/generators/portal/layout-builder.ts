/**
 * レイアウトビルダー
 *
 * ページコンテンツを共通レイアウト（ヘッダー + サイドバー + コンテンツ）でラップする。
 */

import Handlebars from "handlebars";
import { renderTemplate } from "./renderer.js";
import type { SidebarSection } from "./sidebar-builder.js";

/** レイアウトオプション */
export interface LayoutOptions {
  /** ページタイトル */
  title: string;
  /** プロジェクト名 */
  projectName: string;
  /** サイドバーデータ */
  sidebarSections: SidebarSection[];
  /** ページコンテンツ HTML */
  content: string;
  /** パンくずリスト */
  breadcrumbs?: BreadcrumbItem[];
  /** 追加 CSS クラス（body 要素） */
  bodyClass?: string;
  /** ページ固有のスクリプト（HTML 文字列） */
  extraScripts?: string;
  /** 現在のページパス（サイドバーのアクティブ状態に使用） */
  currentPath?: string;
}

/** パンくずアイテム */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * ページコンテンツを共通レイアウトでラップする
 */
export function wrapWithLayout(options: LayoutOptions): string {
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
