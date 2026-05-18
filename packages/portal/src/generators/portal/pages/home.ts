/**
 * ホームページ（ダッシュボード）ジェネレーター
 */

import { renderTemplate } from "../renderer.js";
import type { PortalData } from "../types.js";

/**
 * ホームページの HTML を生成する
 */
export function generateHomePage(data: PortalData): string {
  // 統計サマリーを構築
  const stats = buildStats(data);

  return renderTemplate("pages/home.html.hbs", {
    projectName: data.projectName,
    available: data.available,
    stats,
    featureMap: data.featureMap
      ? {
          moduleCount: Object.keys(data.featureMap.features).length,
          screenCount: Object.values(data.featureMap.features).reduce(
            (sum, g) => sum + (g.screens?.length || 0),
            0
          ),
          componentCount: Object.values(data.featureMap.features).reduce(
            (sum, g) => sum + (g.components?.length || 0),
            0
          ),
          actionCount: Object.values(data.featureMap.features).reduce(
            (sum, g) => sum + (g.actions?.length || 0),
            0
          ),
        }
      : null,
    testCases: data.testCases
      ? {
          totalTests: data.testCases.summary.totalTests,
          jestTests: data.testCases.summary.jestTests,
          playwrightTests: data.testCases.summary.playwrightTests,
        }
      : null,
    dbSchema: data.dbSchema
      ? {
          tableCount: data.dbSchema.tables.length,
          databaseCount: data.dbSchema.databases?.length || 1,
        }
      : null,
    coverage: data.coverage
      ? {
          percent: data.coverage.summary.coveragePercent,
          covered: data.coverage.summary.coveredCount,
          total: data.coverage.summary.totalSources,
        }
      : null,
    i18n: data.i18n
      ? {
          namespaceCount: data.i18n.stats.totalNamespaces,
          keyCount: data.i18n.stats.totalKeys,
          coveragePercent: data.i18n.stats.coveragePercent,
          locales: data.i18n.locales,
        }
      : null,
    packages: data.packages
      ? {
          packageCount: data.packages.summary.totalPackages,
          moduleCount: data.packages.summary.totalModules,
          exportCount: data.packages.summary.totalExports,
        }
      : null,
    apiTools: data.apiTools
      ? {
          toolCount: data.apiTools.summary.totalTools,
          categoryCount: data.apiTools.summary.totalCategories,
        }
      : null,
    applications: data.applications,
  });
}

/** 統計サマリーデータ */
interface StatItem {
  label: string;
  value: number | string;
  unit: string;
  href: string;
  available: boolean;
}

function buildStats(data: PortalData): StatItem[] {
  const stats: StatItem[] = [];

  if (data.available.hasFeatureMap && data.featureMap) {
    const total = Object.values(data.featureMap.features).reduce(
      (sum, g) =>
        sum +
        (g.screens?.length || 0) +
        (g.components?.length || 0) +
        (g.actions?.length || 0),
      0
    );
    stats.push({
      label: "機能アイテム",
      value: total,
      unit: "件",
      href: "/feature-map",
      available: true,
    });
  }

  if (data.available.hasTestCases && data.testCases) {
    stats.push({
      label: "テストケース",
      value: data.testCases.summary.totalTests,
      unit: "件",
      href: "/test-cases",
      available: true,
    });
  }

  if (data.available.hasDbSchema && data.dbSchema) {
    stats.push({
      label: "DBテーブル",
      value: data.dbSchema.tables.length,
      unit: "テーブル",
      href: "/db-schema",
      available: true,
    });
  }

  if (data.coverage) {
    stats.push({
      label: "テストカバレッジ",
      value: `${data.coverage.summary.coveragePercent}%`,
      unit: "",
      href: "/test-cases",
      available: true,
    });
  }

  return stats;
}
