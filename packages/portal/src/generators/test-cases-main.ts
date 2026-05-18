/**
 * test-cases メイン HTML 生成
 *
 * Markdown、サイドバー付き単一ページ HTML、
 * サマリーカードを生成する。
 */

import { basename } from "node:path";
import { wrapHtmlDocument, escapeHtml, icons } from "../utils/html.js";
import type {
  TestCase,
  ModuleInfo,
  TestSummary,
} from "../commands/test-cases-types.js";
import { inferModuleFromPath, getTestCategory } from "../parsers/test-categorization.js";
import {
  fileToId,
  groupBy,
  getSidebarStyles,
  getSearchScript,
} from "./test-cases-styles.js";

// ============================================================
// Markdown Generation
// ============================================================

/**
 * Markdown 生成
 */
export function generateMarkdown(
  testCases: TestCase[],
  summary: TestSummary,
  _projectPath: string
): string {
  const lines: string[] = [
    "# テストケース一覧",
    "",
    `生成日時: ${new Date().toLocaleString("ja-JP")}`,
    "",
    "## サマリー",
    "",
    "| 項目 | 件数 |",
    "|------|------|",
    `| 総テストファイル数 | ${summary.totalFiles} |`,
    `| 総テストケース数 | ${summary.totalTests} |`,
    `| Jest ファイル数 | ${summary.jestFiles} |`,
    `| Jest テスト数 | ${summary.jestTests} |`,
    `| Playwright ファイル数 | ${summary.playwrightFiles} |`,
    `| Playwright テスト数 | ${summary.playwrightTests} |`,
    "",
  ];

  // フレームワーク別に出力
  for (const framework of ["jest", "playwright"] as const) {
    const frameworkCases = testCases.filter((tc) => tc.framework === framework);
    if (frameworkCases.length === 0) continue;

    const title = framework === "jest" ? "Jest テスト" : "Playwright テスト";
    lines.push(`## ${title}`);
    lines.push("");

    // ファイル別にグループ化
    const byFile = groupBy(frameworkCases, (tc) => tc.file);

    for (const [file, cases] of byFile) {
      lines.push(`### ${file}`);
      lines.push("");

      // describe 別にグループ化
      const byDescribe = groupBy(cases, (tc) => tc.describe);

      for (const [describe, describeCases] of byDescribe) {
        // describe レベルのドキュメントを取得
        const describeDoc = describeCases[0]?.describeDocs?.find(
          (d) => d.name === describe
        );

        lines.push(`#### ${describe}`);
        if (describeDoc?.testdoc) {
          lines.push("");
          lines.push(`> ${describeDoc.testdoc}`);
          if (describeDoc.purpose) {
            lines.push(`> `);
            lines.push(`> **目的:** ${describeDoc.purpose}`);
          }
        }
        lines.push("");
        for (const tc of describeCases) {
          // 日本語説明があれば表示
          const displayName = tc.description || tc.it;
          const lineRef = `(L${tc.line})`;
          const bddBadge = tc.bdd?.given || tc.bdd?.when || tc.bdd?.then ? " [BDD]" : "";
          lines.push(`- [ ] ${displayName} ${lineRef}${bddBadge}`);
          if (tc.description && tc.it !== tc.description) {
            lines.push(`  - EN: ${tc.it}`);
          }
          if (tc.purpose) {
            lines.push(`  - 目的: ${tc.purpose}`);
          }
          if (tc.expected) {
            lines.push(`  - 期待: ${tc.expected}`);
          }
          // BDD アノテーション
          if (tc.bdd?.given || tc.bdd?.when || tc.bdd?.then) {
            if (tc.bdd.given) {
              lines.push(`  - **Given**: ${tc.bdd.given}`);
            }
            if (tc.bdd.when) {
              lines.push(`  - **When**: ${tc.bdd.when}`);
            }
            if (tc.bdd.then) {
              lines.push(`  - **Then**: ${tc.bdd.then}`);
            }
            if (tc.bdd.and && tc.bdd.and.length > 0) {
              for (const andItem of tc.bdd.and) {
                lines.push(`  - **And**: ${andItem}`);
              }
            }
          }
        }
        lines.push("");
      }
    }
  }

  // ファイル別統計
  lines.push("## ファイル別統計");
  lines.push("");
  lines.push("| ファイル | フレームワーク | describe数 | テスト数 |");
  lines.push("|----------|---------------|-----------|---------|");

  for (const stat of summary.fileStats) {
    lines.push(
      `| ${stat.file} | ${stat.framework} | ${stat.describes} | ${stat.tests} |`
    );
  }

  lines.push("");

  return lines.join("\n");
}

// ============================================================
// Single-Page HTML Generation (sidebar layout)
// ============================================================

/**
 * HTML 生成 (サイドバー付き)
 */
export function generateHtml(
  testCases: TestCase[],
  summary: TestSummary,
  projectName: string
): string {
  // サイドバーナビゲーション用にファイルをグループ化
  const jestCases = testCases.filter((tc) => tc.framework === "jest");
  const playwrightCases = testCases.filter((tc) => tc.framework === "playwright");

  const jestByFile = groupBy(jestCases, (tc) => tc.file);
  const playwrightByFile = groupBy(playwrightCases, (tc) => tc.file);

  // サイドバー HTML
  const sidebarHtml = buildSidebar(jestByFile, playwrightByFile, summary);

  // メインコンテンツ HTML
  const contentHtml = buildContent(jestByFile, playwrightByFile, summary);

  const styles = getSidebarStyles();

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
    <div class="main-container">
      ${sidebarHtml}
      <main class="content">
        <h1>テストケース一覧</h1>
        ${buildSummaryCard(summary)}
        ${contentHtml}
      </main>
    </div>
  `;

  const scripts = getSearchScript();

  return wrapHtmlDocument({
    title: `テストケース一覧 - ${projectName}`,
    content,
    styles,
    scripts,
  });
}

/**
 * サイドバー HTML を生成（カテゴリ別）
 */
function buildSidebar(
  jestByFile: Map<string, TestCase[]>,
  playwrightByFile: Map<string, TestCase[]>,
  summary: TestSummary
): string {
  // fileStats からモジュール情報を取得するためのマップを作成
  const fileModuleMap = new Map<string, ModuleInfo>();
  for (const stat of summary.fileStats) {
    if (stat.module) {
      fileModuleMap.set(stat.file, stat.module);
    }
  }

  // カテゴリ別にファイルをグループ化
  type FileInfo = { file: string; framework: "jest" | "playwright"; module: ModuleInfo };
  const categorized: Map<string, FileInfo[]> = new Map([
    ["Server Actions", []],
    ["Components", []],
    ["E2E", []],
    ["Other", []],
  ]);

  // 全ファイルをカテゴリ別に振り分け
  for (const [file] of jestByFile.entries()) {
    const module = fileModuleMap.get(file) || inferModuleFromPath(file, "jest");
    const category = getTestCategory(module);
    const existing = categorized.get(category) || [];
    existing.push({ file, framework: "jest", module });
    categorized.set(category, existing);
  }

  for (const [file] of playwrightByFile.entries()) {
    const module = fileModuleMap.get(file) || inferModuleFromPath(file, "playwright");
    const category = getTestCategory(module);
    const existing = categorized.get(category) || [];
    existing.push({ file, framework: "playwright", module });
    categorized.set(category, existing);
  }

  // ナビゲーショングループ生成
  const categoryOrder = ["Server Actions", "Components", "E2E", "Other"];
  const categoryIcons: Record<string, string> = {
    "Server Actions": "&#128640;",  // Rocket
    "Components": "&#128230;",      // Component
    "E2E": "&#127919;",            // Target
    "Other": "&#128196;",          // Document
  };

  const navGroups = categoryOrder
    .map((categoryName) => {
      const files = categorized.get(categoryName) || [];
      if (files.length === 0) return "";

      const navItems = files
        .map(({ file, framework, module: _module }) => {
          const id = `${framework}-${fileToId(file)}`;
          const name = basename(file);
          return `
            <li class="nav-item">
              <a href="#${id}" class="nav-link" title="${escapeHtml(file)}">
                <span class="nav-badge badge-${framework}">${framework.charAt(0).toUpperCase()}</span>
                ${escapeHtml(name)}
              </a>
            </li>
          `;
        })
        .join("\n");

      return `
        <div class="nav-group">
          <div class="nav-group-title">
            <span class="nav-category-icon">${categoryIcons[categoryName]}</span>
            <span class="nav-category-name">${categoryName}</span>
            <span class="badge-count">${files.length}</span>
          </div>
          <ul class="nav-list">
            ${navItems}
          </ul>
        </div>
      `;
    })
    .filter(Boolean)
    .join("\n");

  return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title">テストファイル</div>
      </div>
      ${navGroups}
    </aside>
  `;
}

/**
 * メインコンテンツ HTML を生成（カテゴリ別グループ化 + 関連モジュール表示）
 */
function buildContent(
  jestByFile: Map<string, TestCase[]>,
  playwrightByFile: Map<string, TestCase[]>,
  summary: TestSummary
): string {
  // fileStats からモジュール情報を取得するためのマップを作成
  const fileModuleMap = new Map<string, ModuleInfo>();
  for (const stat of summary.fileStats) {
    if (stat.module) {
      fileModuleMap.set(stat.file, stat.module);
    }
  }

  // カテゴリ別にファイルをグループ化
  type CategoryData = {
    files: Map<string, TestCase[]>;
    framework: "jest" | "playwright";
  };
  const categories: Map<string, CategoryData[]> = new Map([
    ["Server Actions", []],
    ["Components", []],
    ["E2E", []],
    ["Other", []],
  ]);

  // Jest ファイルをカテゴリ別に振り分け
  for (const [file, cases] of jestByFile.entries()) {
    const module = fileModuleMap.get(file) || inferModuleFromPath(file, "jest");
    const category = getTestCategory(module);
    const existing = categories.get(category) || [];
    // 既存のカテゴリにファイルを追加
    let found = existing.find((d) => d.framework === "jest");
    if (!found) {
      found = { files: new Map(), framework: "jest" };
      existing.push(found);
      categories.set(category, existing);
    }
    found.files.set(file, cases);
  }

  // Playwright ファイルをカテゴリ別に振り分け
  for (const [file, cases] of playwrightByFile.entries()) {
    const module = fileModuleMap.get(file) || inferModuleFromPath(file, "playwright");
    const category = getTestCategory(module);
    const existing = categories.get(category) || [];
    let found = existing.find((d) => d.framework === "playwright");
    if (!found) {
      found = { files: new Map(), framework: "playwright" };
      existing.push(found);
      categories.set(category, existing);
    }
    found.files.set(file, cases);
  }

  // ファイルセクション生成関数
  const buildFileSections = (
    byFile: Map<string, TestCase[]>,
    prefix: string,
    framework: "jest" | "playwright"
  ): string => {
    return Array.from(byFile.entries())
      .map(([file, cases]) => {
        const id = `${prefix}-${fileToId(file)}`;
        const module = fileModuleMap.get(file) || inferModuleFromPath(file, framework);
        const byDescribe = groupBy(cases, (tc) => tc.describe);

        // 関連モジュールリンク（旧形式: test-cases.html からの相対パス）
        const moduleLink = module.type !== "unknown" && module.detailPath
          ? `<a href="${module.detailPath}" class="module-link">
              <span class="module-badge module-badge-${module.type}">${module.type}</span>
              ${escapeHtml(module.name)}
            </a>`
          : `<span class="module-unknown">${escapeHtml(module.name)}</span>`;

        const describeSections = Array.from(byDescribe.entries())
          .map(([describe, describeCases]) => {
            // describe レベルのドキュメントを取得 (最初のテストケースから)
            const describeDoc = describeCases[0]?.describeDocs?.find(
              (d) => d.name === describe
            );
            const describeDocHtml = describeDoc?.testdoc
              ? `<div class="describe-doc">
                  <span class="describe-doc-text">${escapeHtml(describeDoc.testdoc)}</span>
                  ${describeDoc.purpose ? `<span class="describe-doc-purpose">目的: ${escapeHtml(describeDoc.purpose)}</span>` : ""}
                </div>`
              : "";

            const testItems = describeCases
              .map((tc) => {
                // 日本語説明があれば優先表示
                const displayName = tc.description || tc.it;
                const hasDetails = tc.purpose || tc.precondition || tc.expected;
                const hasBdd = !!(tc.bdd?.given || tc.bdd?.when || tc.bdd?.then);
                const hasJapanese = !!tc.description;

                // 従来のドキュメント詳細
                const detailsHtml = hasDetails
                  ? `
                    <div class="test-details">
                      ${tc.purpose ? `<div class="detail-item detail-purpose"><span class="detail-label">目的:</span> ${escapeHtml(tc.purpose)}</div>` : ""}
                      ${tc.precondition ? `<div class="detail-item detail-precondition"><span class="detail-label">前提:</span> ${escapeHtml(tc.precondition)}</div>` : ""}
                      ${tc.expected ? `<div class="detail-item detail-expected"><span class="detail-label">期待:</span> ${escapeHtml(tc.expected)}</div>` : ""}
                    </div>
                  `
                  : "";

                // BDD アノテーション
                const bddHtml = hasBdd
                  ? `
                    <div class="bdd-details">
                      ${tc.bdd?.given ? `<div class="bdd-item bdd-given"><span class="bdd-label">Given</span> ${escapeHtml(tc.bdd.given)}</div>` : ""}
                      ${tc.bdd?.when ? `<div class="bdd-item bdd-when"><span class="bdd-label">When</span> ${escapeHtml(tc.bdd.when)}</div>` : ""}
                      ${tc.bdd?.then ? `<div class="bdd-item bdd-then"><span class="bdd-label">Then</span> ${escapeHtml(tc.bdd.then)}</div>` : ""}
                      ${tc.bdd?.and?.map((andItem) => `<div class="bdd-item bdd-and"><span class="bdd-label">And</span> ${escapeHtml(andItem)}</div>`).join("") || ""}
                    </div>
                  `
                  : "";

                return `
                <li class="test-item ${hasDetails || hasBdd ? "has-details" : ""} ${hasJapanese ? "has-japanese" : ""} ${hasBdd ? "has-bdd" : ""}">
                  <div class="test-header">
                    <span class="test-name">${escapeHtml(displayName)}</span>
                    <div class="test-meta">
                      ${hasBdd ? `<span class="test-bdd-badge">BDD</span>` : ""}
                      ${hasJapanese ? `<span class="test-original" title="${escapeHtml(tc.it)}">[EN]</span>` : ""}
                      <span class="test-line">L${tc.line}</span>
                    </div>
                  </div>
                  ${bddHtml}
                  ${detailsHtml}
                </li>
              `;
              })
              .join("\n");

            return `
              <div class="describe-block ${describeDoc?.testdoc ? "has-doc" : ""}">
                <h4 class="describe-title">${escapeHtml(describe)}</h4>
                ${describeDocHtml}
                <ul class="test-list">${testItems}</ul>
              </div>
            `;
          })
          .join("\n");

        return `
          <section id="${id}" class="file-section" data-framework="${framework}" data-module-type="${module.type}" data-module-name="${escapeHtml(module.name)}">
            <div class="file-header">
              <div class="file-header-left">
                <span class="badge badge-${framework}">${framework}</span>
                <h3 class="file-path">${escapeHtml(file)}</h3>
              </div>
              <div class="file-header-right">
                ${moduleLink}
                <span class="test-count">${cases.length} tests</span>
              </div>
            </div>
            ${describeSections}
          </section>
        `;
      })
      .join("\n");
  };

  // カテゴリ別にコンテンツを生成
  const categoryOrder = ["Server Actions", "Components", "E2E", "Other"];
  const categoryIcons: Record<string, string> = {
    "Server Actions": icons.action,  // Lightning bolt
    "Components": icons.component,   // Component box
    "E2E": icons.screen,             // Screen (E2E tests are screen tests)
    "Other": icons.file,             // File
  };

  let contentHtml = "";

  for (const categoryName of categoryOrder) {
    const categoryData = categories.get(categoryName) || [];
    const hasContent = categoryData.some((d) => d.files.size > 0);

    if (!hasContent) continue;

    const totalTests = categoryData.reduce(
      (sum, d) => sum + Array.from(d.files.values()).reduce((s, cases) => s + cases.length, 0),
      0
    );

    contentHtml += `
      <div class="category-section" id="category-${categoryName.toLowerCase().replace(/\s+/g, "-")}">
        <h2 class="category-title">
          <span class="category-icon">${categoryIcons[categoryName]}</span>
          ${categoryName}
          <span class="category-count">${totalTests} tests</span>
        </h2>
    `;

    for (const data of categoryData) {
      if (data.files.size === 0) continue;
      contentHtml += buildFileSections(data.files, data.framework, data.framework);
    }

    contentHtml += `</div>`;
  }

  return contentHtml;
}

/**
 * サマリーカード HTML を生成
 */
export function buildSummaryCard(summary: TestSummary): string {
  return `
    <div class="summary-card">
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${summary.totalFiles}</div>
          <div class="summary-label">ファイル数</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${summary.totalTests}</div>
          <div class="summary-label">テスト数</div>
        </div>
        <div class="summary-item summary-jest">
          <div class="summary-value">${summary.jestTests}</div>
          <div class="summary-label">Jest</div>
        </div>
        <div class="summary-item summary-playwright">
          <div class="summary-value">${summary.playwrightTests}</div>
          <div class="summary-label">Playwright</div>
        </div>
      </div>
      <div class="summary-meta">
        生成日時: ${new Date().toLocaleString("ja-JP")}
      </div>
    </div>
  `;
}
