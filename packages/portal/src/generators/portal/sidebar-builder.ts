/**
 * サイドバーナビゲーションビルダー
 *
 * PortalData を元にサイドバーのナビゲーションリンクデータを生成する。
 */

import type { PortalData } from "./types.js";

/** サイドバーセクション */
export interface SidebarSection {
  /** セクション見出し */
  title: string;
  /** ナビゲーションリンク一覧 */
  links: SidebarLink[];
}

/** サイドバーリンク */
export interface SidebarLink {
  /** 表示ラベル */
  label: string;
  /** リンク先 URL */
  href: string;
  /** アイコン名（テンプレートで使用する文字列キー） */
  icon?: string;
  /** バッジ数値 */
  count?: number;
  /** 子リンク */
  children?: SidebarLink[];
}

/**
 * PortalData からサイドバーデータを構築する
 */
export function buildSidebarData(data: PortalData): SidebarSection[] {
  const sections: SidebarSection[] = [];

  // ホームセクション
  sections.push({
    title: "メイン",
    links: [
      { label: "ダッシュボード", href: "/", icon: "home" },
    ],
  });

  // プロジェクトセクション
  const projectLinks: SidebarLink[] = [];

  if (data.available.hasOverview) {
    projectLinks.push({
      label: "概要",
      href: "/overview",
      icon: "file-text",
    });
  }

  if (data.available.hasFeatureMap) {
    const featureCount = data.featureMap
      ? Object.values(data.featureMap.features).reduce(
          (sum, g) =>
            sum +
            (g.screens?.length || 0) +
            (g.components?.length || 0) +
            (g.actions?.length || 0),
          0
        )
      : undefined;

    projectLinks.push({
      label: "機能マップ",
      href: "/feature-map",
      icon: "layers",
      count: featureCount,
    });
  }

  if (data.available.hasDbSchema) {
    const tableCount = data.dbSchema?.tables.length;
    const databases = data.dbSchema?.databases;

    if (databases && databases.length > 1) {
      // 複数 DB の場合は子リンクを展開
      projectLinks.push({
        label: "DB スキーマ",
        href: "/db-schema",
        icon: "database",
        count: tableCount,
        children: databases.map((db) => ({
          label: db.name,
          href: `/db-schema/${encodeURIComponent(db.name)}`,
          count: db.tableCount,
        })),
      });
    } else {
      projectLinks.push({
        label: "DB スキーマ",
        href: "/db-schema",
        icon: "database",
        count: tableCount,
      });
    }
  }

  if (data.available.hasTestCases) {
    const testCount = data.testCases?.summary.totalTests;
    projectLinks.push({
      label: "テストケース",
      href: "/test-cases",
      icon: "check-circle",
      count: testCount,
    });
  }

  if (projectLinks.length > 0) {
    sections.push({ title: "プロジェクト", links: projectLinks });
  }

  // アプリセクション
  if (
    data.available.hasApplications &&
    data.applications?.apps &&
    data.applications.apps.length > 0
  ) {
    const appLinks: SidebarLink[] = data.applications.apps.map((app) => ({
      label: app.name,
      href: `/apps/${encodeURIComponent(app.id)}`,
      icon: app.icon,
    }));

    sections.push({ title: "アプリケーション", links: appLinks });
  }

  // 追加セクション
  const additionalLinks: SidebarLink[] = [];

  if (data.available.hasI18n) {
    const namespaceCount = data.i18n?.stats.totalNamespaces;
    additionalLinks.push({
      label: "i18n",
      href: "/i18n",
      icon: "languages",
      count: namespaceCount,
    });
  }

  if (data.available.hasPackages) {
    const packageCount = data.packages?.summary.totalPackages;
    additionalLinks.push({
      label: "パッケージ",
      href: "/packages",
      icon: "package",
      count: packageCount,
    });
  }

  if (data.available.hasApiTools) {
    const toolCount = data.apiTools?.summary.totalTools;
    additionalLinks.push({
      label: "API ツール",
      href: "/api-tools",
      icon: "wrench",
      count: toolCount,
    });
  }

  if (additionalLinks.length > 0) {
    sections.push({ title: "その他", links: additionalLinks });
  }

  return sections;
}
