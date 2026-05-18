/**
 * test-cases 階層 HTML 生成
 *
 * 3階層構造のテストケースページを生成する:
 * 1. カテゴリ一覧 (test-cases.html)
 * 2. ファイル一覧 (test-cases/{category}.html)
 * 3. テスト詳細 (test-cases/{category}/{file}.html)
 */

import { resolve, basename } from "node:path";
import { wrapHtmlDocument, escapeHtml, icons } from "../utils/html.js";
import { ensureDir, writeFile } from "../utils/file.js";
import type {
  TestCase,
  TestCategory,
  FileStats,
  TestSummary,
} from "../commands/test-cases-types.js";
import {
  inferCategoryFromTestName,
  inferModuleFromPath,
  getTestCategory,
} from "../parsers/test-categorization.js";
import {
  groupBy,
  categoryToSlug,
  fileToSlug,
  getCategoryIcon,
  getCategoryColor,
  getCategoryBadgeHtml,
  getGlobalNavElements,
  getCategoryListStyles,
  getFileListStyles,
  getTestDetailStyles,
} from "./test-cases-styles.js";

// ============================================================
// Category List Page (test-cases.html)
// ============================================================

/**
 * カテゴリ一覧ページを生成 (test-cases.html)
 */
export function generateCategoryListPage(
  testCases: TestCase[],
  summary: TestSummary,
  projectName: string
): string {
  // カテゴリ別に集計
  const categoryOrder = ["Server Actions", "Components", "E2E", "Other"];
  const categoryStats: Map<string, { files: number; tests: number; categoryStats: Record<TestCategory, number> }> = new Map();

  for (const category of categoryOrder) {
    categoryStats.set(category, { files: 0, tests: 0, categoryStats: { "happy-path": 0, auth: 0, "error-handling": 0, validation: 0, "edge-case": 0, integration: 0, other: 0 } });
  }

  // fileStats からカテゴリ別に集計
  for (const stat of summary.fileStats) {
    const module = stat.module || inferModuleFromPath(stat.file, stat.framework);
    const category = getTestCategory(module);
    const current = categoryStats.get(category)!;
    current.files++;
    current.tests += stat.tests;
    // カテゴリ別テスト数を集計
    if (stat.categoryStats) {
      for (const [cat, count] of Object.entries(stat.categoryStats)) {
        current.categoryStats[cat as TestCategory] += count;
      }
    }
  }

  // カテゴリカード生成
  const categoryCards = categoryOrder
    .map((category) => {
      const stats = categoryStats.get(category)!;
      if (stats.files === 0) return "";

      const slug = categoryToSlug(category);
      const icon = getCategoryIcon(category);
      const color = getCategoryColor(category);

      // カテゴリバッジ
      const badges = Object.entries(stats.categoryStats)
        .filter(([, count]) => count > 0)
        .map(([cat, count]) => getCategoryBadgeHtml(cat as TestCategory, count))
        .join("");

      return `
        <a href="test-cases/${slug}.html" class="category-card category-${color}">
          <div class="category-icon">${icon}</div>
          <h2 class="category-name">${category}</h2>
          <div class="category-stats">
            <span class="stat-files">${stats.files} files</span>
            <span class="stat-tests">${stats.tests} tests</span>
          </div>
          <div class="category-badges">${badges}</div>
        </a>
      `;
    })
    .filter(Boolean)
    .join("\n");

  const styles = getCategoryListStyles();

  const content = `
    <div class="header">
      <a href="index.html" class="back-link">
        ${icons.back}
        ポータルに戻る
      </a>
      <div class="search-box">
        <input type="text" class="search-input" id="searchInput" placeholder="テストを検索...">
      </div>
    </div>
    <div class="container">
      <div class="page-header">
        <h1>テストケース</h1>
        <p class="page-stats">${summary.totalTests} テスト / ${summary.totalFiles} ファイル / ${categoryOrder.filter((c) => categoryStats.get(c)!.files > 0).length} カテゴリ</p>
      </div>

      <div class="category-grid">
        ${categoryCards}
      </div>

      <div class="summary-meta">
        生成日時: ${new Date().toLocaleString("ja-JP")}
      </div>
    </div>
  `;

  return wrapHtmlDocument({
    title: `テストケース - ${projectName}`,
    content,
    styles,
  });
}

// ============================================================
// Hierarchical Page Generation
// ============================================================

/**
 * 階層的なページを生成
 */
export function generateHierarchicalPages(
  testCases: TestCase[],
  summary: TestSummary,
  projectName: string,
  outputDir: string
): { categoryPages: number; detailPages: number } {
  let categoryPages = 0;
  let detailPages = 0;

  // カテゴリ別にファイルをグループ化
  const categoryOrder = ["Server Actions", "Components", "E2E", "Other"];
  const byCategory: Map<string, FileStats[]> = new Map();

  for (const category of categoryOrder) {
    byCategory.set(category, []);
  }

  for (const stat of summary.fileStats) {
    const module = stat.module || inferModuleFromPath(stat.file, stat.framework);
    const category = getTestCategory(module);
    byCategory.get(category)!.push(stat);
  }

  // テストケースをファイル別にグループ化
  const testsByFile = groupBy(testCases, (tc) => tc.file);

  // 各カテゴリのファイル一覧ページと詳細ページを生成
  for (const [category, files] of byCategory.entries()) {
    if (files.length === 0) continue;

    const categorySlug = categoryToSlug(category);
    const categoryDir = resolve(outputDir, categorySlug);
    ensureDir(categoryDir);

    // ファイル一覧ページ生成
    const fileListContent = generateFileListPage(category, files, testsByFile, projectName);
    writeFile(resolve(outputDir, `${categorySlug}.html`), fileListContent);
    categoryPages++;

    // テスト詳細ページ生成
    for (const fileStat of files) {
      const fileSlug = fileToSlug(fileStat.file);
      const fileCases = testsByFile.get(fileStat.file) || [];
      const detailContent = generateTestDetailPage(category, fileStat, fileCases, projectName);
      writeFile(resolve(categoryDir, `${fileSlug}.html`), detailContent);
      detailPages++;
    }
  }

  return { categoryPages, detailPages };
}

// ============================================================
// File List Page (test-cases/{category}.html)
// ============================================================

/**
 * ファイル一覧ページを生成 (test-cases/{category}.html)
 */
function generateFileListPage(
  category: string,
  files: FileStats[],
  testsByFile: Map<string, TestCase[]>,
  projectName: string
): string {
  const categorySlug = categoryToSlug(category);
  const categoryIcon = getCategoryIcon(category);
  const totalTests = files.reduce((sum, f) => sum + f.tests, 0);

  // ファイルカード生成
  const fileCards = files
    .map((fileStat) => {
      const fileSlug = fileToSlug(fileStat.file);
      const fileName = basename(fileStat.file);
      // ファイル説明 (fileDoc から取得)
      const fileDesc = fileStat.fileDoc?.description
        || `${fileStat.module?.name || fileName} のテスト`;

      // カテゴリバッジ
      const badges = fileStat.categoryStats
        ? Object.entries(fileStat.categoryStats)
            .filter(([, count]) => count > 0)
            .map(([cat, count]) => getCategoryBadgeHtml(cat as TestCategory, count))
            .join("")
        : "";

      // 関連モジュールリンク（test-cases/{category}.html からの相対パス）
      const moduleLink = fileStat.module && fileStat.module.type !== "unknown" && fileStat.module.detailPath
        ? `<a href="../${fileStat.module.detailPath}" class="module-link" title="モジュール詳細を見る">
            → ${escapeHtml(fileStat.module.name)}
          </a>`
        : "";

      return `
        <a href="${categorySlug}/${fileSlug}.html" class="file-card">
          <div class="file-header">
            <span class="file-name">${escapeHtml(fileName)}</span>
            <span class="test-count">${fileStat.tests} tests</span>
          </div>
          <p class="file-desc">${escapeHtml(fileDesc)}</p>
          <div class="file-meta">
            ${moduleLink}
            <div class="category-badges">${badges}</div>
          </div>
        </a>
      `;
    })
    .join("\n");

  const styles = getFileListStyles();

  const content = `
    <div class="header">
      <a href="../test-cases.html" class="back-link">
        ${icons.back}
        カテゴリ一覧に戻る
      </a>
    </div>
    <div class="container">
      <nav class="breadcrumb">
        <a href="../test-cases.html">テストケース</a>
        <span class="separator">/</span>
        <span class="current">${category}</span>
      </nav>

      <div class="page-header">
        <h1>${categoryIcon} ${category}</h1>
        <p class="page-stats">${files.length} ファイル / ${totalTests} テスト</p>
      </div>

      <div class="file-list">
        ${fileCards}
      </div>
    </div>
  `;

  const globalNav = getGlobalNavElements(1); // test-cases/ からの深度

  return wrapHtmlDocument({
    title: `${category} - テストケース - ${projectName}`,
    content,
    styles,
    headElements: globalNav.headElements,
    bodyEndScripts: globalNav.bodyEndScripts,
  });
}

// ============================================================
// Test Detail Page (test-cases/{category}/{file}.html)
// ============================================================

/**
 * テスト詳細ページを生成 (test-cases/{category}/{file}.html)
 */
function generateTestDetailPage(
  category: string,
  fileStat: FileStats,
  testCases: TestCase[],
  projectName: string
): string {
  const categorySlug = categoryToSlug(category);
  const fileName = basename(fileStat.file);
  const fileDesc = fileStat.fileDoc?.description
    || `${fileStat.module?.name || fileName} のテスト`;

  // describe 別にグループ化
  const byDescribe = groupBy(testCases, (tc) => tc.describe);

  // テストグループ生成
  const testGroups = Array.from(byDescribe.entries())
    .map(([describe, cases]) => {
      // describe レベルのドキュメント
      const describeDoc = cases[0]?.describeDocs?.find((d) => d.name === describe);
      const descDocHtml = describeDoc?.testdoc
        ? `<p class="group-desc">${escapeHtml(describeDoc.testdoc)}</p>`
        : "";

      // テストアイテム
      const testItems = cases
        .map((tc) => {
          const displayName = tc.description || tc.it;
          const category = tc.category || inferCategoryFromTestName(tc.it, tc.description);
          const categoryBadge = getCategoryBadgeHtml(category, 1);

          // 詳細情報
          const detailsHtml = tc.purpose || tc.expected
            ? `
              <div class="test-details">
                ${tc.purpose ? `<div class="detail-item"><span class="detail-label">目的:</span> ${escapeHtml(tc.purpose)}</div>` : ""}
                ${tc.expected ? `<div class="detail-item"><span class="detail-label">期待:</span> ${escapeHtml(tc.expected)}</div>` : ""}
              </div>
            `
            : "";

          // 英語名表示
          const originalHtml = tc.description && tc.it !== tc.description
            ? `<p class="test-original">EN: ${escapeHtml(tc.it)}</p>`
            : "";

          return `
            <div class="test-item">
              <div class="test-header">
                <span class="test-name">${escapeHtml(displayName)}</span>
                <span class="test-line">L${tc.line}</span>
              </div>
              ${originalHtml}
              ${detailsHtml}
              <div class="test-category">${categoryBadge}</div>
            </div>
          `;
        })
        .join("\n");

      return `
        <div class="test-group" id="${escapeHtml(describe.replace(/[^a-zA-Z0-9]/g, "-"))}">
          <h2 class="group-header">
            <span class="group-name">${escapeHtml(describe)}</span>
            <span class="group-count">${cases.length} tests</span>
          </h2>
          ${descDocHtml}
          <div class="test-list">
            ${testItems}
          </div>
        </div>
      `;
    })
    .join("\n");

  // 関連モジュールリンク（test-cases/{category}/{file}.html からの相対パス）
  const moduleLink = fileStat.module && fileStat.module.type !== "unknown" && fileStat.module.detailPath
    ? `<a href="../../${fileStat.module.detailPath}" class="module-link-large">
        → ${escapeHtml(fileStat.module.name)} モジュール詳細
      </a>`
    : "";

  const styles = getTestDetailStyles();

  const content = `
    <div class="header">
      <a href="../${categorySlug}.html" class="back-link">
        ${icons.back}
        ファイル一覧に戻る
      </a>
    </div>
    <div class="container">
      <nav class="breadcrumb">
        <a href="../../test-cases.html">テストケース</a>
        <span class="separator">/</span>
        <a href="../${categorySlug}.html">${category}</a>
        <span class="separator">/</span>
        <span class="current">${escapeHtml(fileName)}</span>
      </nav>

      <div class="page-header">
        <h1>${escapeHtml(fileName)}</h1>
        <p class="file-desc">${escapeHtml(fileDesc)}</p>
        ${moduleLink}
      </div>

      <div class="test-groups">
        ${testGroups}
      </div>
    </div>
  `;

  const globalNav = getGlobalNavElements(2); // test-cases/category/ からの深度

  return wrapHtmlDocument({
    title: `${fileName} - ${category} - テストケース - ${projectName}`,
    content,
    styles,
    headElements: globalNav.headElements,
    bodyEndScripts: globalNav.bodyEndScripts,
  });
}
