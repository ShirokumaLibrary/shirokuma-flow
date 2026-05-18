/**
 * details-module-page - モジュール詳細ページ生成
 *
 * モジュール単位の概要ページ（型定義・ユーティリティ・テスト一覧）を生成する。
 */

import { resolve, basename } from "node:path";
import { wrapHtmlDocument, escapeHtml, formatDescription } from "../utils/html.js";
import { writeFile } from "../utils/file.js";
import type {
  ModulePageData,
  Screen,
  Component,
  Action,
  Table,
  TypeItem,
  UtilityItem,
  CategorizedTestCase,
  TestCategory,
} from "../commands/details-types.js";
import { splitTypeSourceCode } from "../parsers/details-jsdoc.js";
import {
  categoryLabels,
  getCdnScripts,
  getDetailStyles,
  getDetailScripts,
  getModuleSpecificStyles,
  generateTestPageUrl,
} from "./details-styles.js";

/**
 * モジュールのテストリストをHTMLで生成
 *
 * @description テストケースをファイル別にグループ化し、test-cases.htmlへのリンク付きで表示
 */
export function buildModuleTestsList(testCases: CategorizedTestCase[], _moduleName: string): string {
  // ファイル別にグループ化
  const byFile = new Map<string, CategorizedTestCase[]>();
  for (const tc of testCases) {
    const existing = byFile.get(tc.file) || [];
    existing.push(tc);
    byFile.set(tc.file, existing);
  }

  // ファイル別セクションを生成
  const fileSections = Array.from(byFile.entries())
    .map(([file, cases]) => {
      // 3階層URL（depth=2: details/{type}/ から）
      const testPageUrl = generateTestPageUrl(file, cases[0].framework, 2);
      const fileName = basename(file);

      // カテゴリ別に集計
      const categoryCounts = new Map<TestCategory, number>();
      for (const tc of cases) {
        const count = categoryCounts.get(tc.category) || 0;
        categoryCounts.set(tc.category, count + 1);
      }

      // カテゴリバッジ
      const categoryBadges = Array.from(categoryCounts.entries())
        .map(([cat, count]) => {
          const info = categoryLabels[cat];
          return `<span class="module-test-category" style="background: ${info.color}20; color: ${info.color}">${info.icon} ${count}</span>`;
        })
        .join("");

      // テストケースリスト（最大5件表示）
      const displayCases = cases.slice(0, 5);
      const moreCount = cases.length > 5 ? cases.length - 5 : 0;

      const testItemsHTML = displayCases
        .map(
          (tc) => `
          <div class="module-test-item">
            <span class="module-test-name">${escapeHtml(tc.description || tc.summary)}</span>
            <span class="module-test-line">L${tc.line}</span>
          </div>
        `
        )
        .join("");

      return `
        <div class="module-test-file-section">
          <div class="module-test-file-header">
            <a href="${testPageUrl}" class="module-test-file-link">
              ${escapeHtml(fileName)}
            </a>
            <div class="module-test-file-meta">
              <span class="module-test-count">${cases.length} tests</span>
              ${categoryBadges}
            </div>
          </div>
          <div class="module-test-items">
            ${testItemsHTML}
            ${moreCount > 0 ? `<a href="${testPageUrl}" class="module-test-more">+${moreCount} more tests</a>` : ""}
          </div>
        </div>
      `;
    })
    .join("");

  // テストファイルがない場合
  if (fileSections.length === 0) {
    return '<div class="empty-message">関連するテストが見つかりませんでした</div>';
  }

  return `<div class="module-tests-list">${fileSections}</div>`;
}

/**
 * モジュール詳細ページを生成
 */
export function generateModuleDetailPage(
  data: ModulePageData,
  detailsDir: string
): void {
  const typeLabels: Record<string, string> = {
    screen: "Screen",
    component: "Component",
    action: "Server Action",
    table: "Database Table",
  };

  const typeLabelsJa: Record<string, string> = {
    screen: "Screens",
    component: "Components",
    action: "Actions",
    table: "Tables",
  };

  const typeColors: Record<string, string> = {
    screen: "blue",
    component: "green",
    action: "orange",
    table: "pink",
  };

  const color = typeColors[data.type];
  const cdnScripts = getCdnScripts();

  // アイテムリスト
  const itemListHTML = data.items.length > 0
    ? data.items.map((item) => {
        const description = item.description || "";
        return `
          <a href="${escapeHtml(data.moduleName)}/${escapeHtml(item.name)}.html" class="module-item">
            <div class="module-item-main">
              <span class="module-item-name">${escapeHtml(item.name)}</span>
              ${description ? `<span class="module-item-desc">${escapeHtml(description.substring(0, 80))}${description.length > 80 ? "..." : ""}</span>` : ""}
            </div>
            <div class="module-item-meta">
              ${getItemMeta(data.type, item)}
            </div>
          </a>
        `;
      }).join("")
    : '<div class="empty-message">アイテムがありません</div>';

  // タブの表示/非表示を決定
  const hasTypes = data.types && data.types.length > 0;
  const hasUtilities = data.utilities && data.utilities.length > 0;
  const hasTests = data.testCases && data.testCases.length > 0;

  // Types タブコンテンツ
  const typesTabContent = hasTypes
    ? `
      <div id="types" class="tab-content">
        <div class="section">
          <h3 class="section-title">Types (${data.types!.length})</h3>
          <div class="types-list">
            ${data.types!.map((type) => buildTypeItem(type)).join("")}
          </div>
        </div>
      </div>
    `
    : "";

  // Utilities タブコンテンツ
  const utilitiesTabContent = hasUtilities
    ? `
      <div id="utilities" class="tab-content">
        <div class="section">
          <h3 class="section-title">Utilities (${data.utilities!.length})</h3>
          <div class="utilities-list">
            ${data.utilities!.map((util) => buildUtilityItem(util)).join("")}
          </div>
        </div>
      </div>
    `
    : "";

  // Tests タブコンテンツ
  const testsTabContent = hasTests
    ? `
      <div id="tests" class="tab-content">
        <div class="section">
          <h3 class="section-title">関連テスト (${data.testCases!.length})</h3>
          ${buildModuleTestsList(data.testCases!, data.moduleName)}
        </div>
      </div>
    `
    : "";

  const content = `
    ${cdnScripts}
    <div class="container">
      <div class="page-header">
        <h1 class="page-title">
          ${escapeHtml(data.moduleName)}
          <span class="page-badge badge-${color}">${typeLabels[data.type]} Module</span>
        </h1>
        ${data.moduleDescription ? `<p class="page-description">${escapeHtml(data.moduleDescription.split("\n")[0])}</p>` : ""}
      </div>

      <div class="tabs">
        <button class="tab active" onclick="showTab('overview')">概要</button>
        <button class="tab" onclick="showTab('items')">${typeLabelsJa[data.type]} (${data.items.length})</button>
        ${hasTypes ? `<button class="tab" onclick="showTab('types')">Types (${data.types!.length})</button>` : ""}
        ${hasUtilities ? `<button class="tab" onclick="showTab('utilities')">Utilities (${data.utilities!.length})</button>` : ""}
        ${hasTests ? `<button class="tab" onclick="showTab('tests')">Tests (${data.testCases!.length})</button>` : ""}
      </div>

      <div id="overview" class="tab-content active">
        ${data.moduleDescription ? `
          <div class="section">
            <h3 class="section-title">説明</h3>
            <div class="module-description">${formatDescription(data.moduleDescription)}</div>
          </div>
        ` : ""}
        <div class="section">
          <h3 class="section-title">統計情報</h3>
          <div class="module-stats">
            <div class="stat-item">
              <span class="stat-value">${data.items.length}</span>
              <span class="stat-label">${typeLabelsJa[data.type]}</span>
            </div>
            ${hasTypes ? `
              <div class="stat-item">
                <span class="stat-value">${data.types!.length}</span>
                <span class="stat-label">Types</span>
              </div>
            ` : ""}
            ${hasUtilities ? `
              <div class="stat-item">
                <span class="stat-value">${data.utilities!.length}</span>
                <span class="stat-label">Utilities</span>
              </div>
            ` : ""}
            ${hasTests ? `
              <div class="stat-item">
                <span class="stat-value">${data.testCases!.length}</span>
                <span class="stat-label">Tests</span>
              </div>
            ` : ""}
            ${getModuleStats(data.type, data.items)}
          </div>
        </div>
      </div>

      <div id="items" class="tab-content">
        <div class="section">
          <h3 class="section-title">${typeLabelsJa[data.type]} 一覧</h3>
          <div class="module-items-list">
            ${itemListHTML}
          </div>
        </div>
      </div>

      ${typesTabContent}

      ${utilitiesTabContent}

      ${testsTabContent}
    </div>
  `;

  // detail スタイルをベースに、モジュール固有スタイルを追加
  const styles = getDetailStyles(color) + getModuleSpecificStyles(color);
  const scripts = getDetailScripts();

  const html = wrapHtmlDocument({
    title: `${data.moduleName} - ${typeLabels[data.type]} Module | ${data.projectName}`,
    content,
    styles,
    scripts,
  });

  // 出力先: details/{type}/{moduleName}.html
  const outputPath = resolve(detailsDir, data.type, `${data.moduleName}.html`);
  writeFile(outputPath, html);
}

/**
 * アイテムのメタ情報を取得
 */
export function getItemMeta(type: string, item: Screen | Component | Action | Table): string {
  switch (type) {
    case "screen":
      const screen = item as Screen;
      return screen.route ? `<span class="item-route">${escapeHtml(screen.route)}</span>` : "";
    case "component":
      const comp = item as Component;
      const usedIn = comp.usedInScreens?.length || 0;
      return usedIn > 0 ? `<span class="item-meta">${usedIn} screens</span>` : "";
    case "action":
      const action = item as Action;
      const tables = action.dbTables?.length || 0;
      return tables > 0 ? `<span class="item-meta">${tables} tables</span>` : "";
    case "table":
      const table = item as Table;
      const actions = table.usedInActions?.length || 0;
      return actions > 0 ? `<span class="item-meta">${actions} actions</span>` : "";
    default:
      return "";
  }
}

/**
 * モジュールの統計情報を取得
 */
export function getModuleStats(type: string, items: (Screen | Component | Action | Table)[]): string {
  switch (type) {
    case "action": {
      const totalTables = new Set<string>();
      for (const item of items) {
        const action = item as Action;
        action.dbTables?.forEach((t) => totalTables.add(t));
      }
      if (totalTables.size > 0) {
        return `
          <div class="stat-item">
            <span class="stat-value">${totalTables.size}</span>
            <span class="stat-label">DB Tables</span>
          </div>
        `;
      }
      break;
    }
    case "component": {
      const totalScreens = new Set<string>();
      for (const item of items) {
        const comp = item as Component;
        comp.usedInScreens?.forEach((s) => totalScreens.add(s));
      }
      if (totalScreens.size > 0) {
        return `
          <div class="stat-item">
            <span class="stat-value">${totalScreens.size}</span>
            <span class="stat-label">Used in Screens</span>
          </div>
        `;
      }
      break;
    }
  }
  return "";
}

/**
 * 型定義アイテムをHTMLで生成
 */
export function buildTypeItem(type: TypeItem): string {
  const kindBadgeColors: Record<string, string> = {
    interface: "blue",
    type: "green",
    enum: "purple",
  };
  const badgeColor = kindBadgeColors[type.kind] || "gray";

  // ソースコードがある場合：JSDocは整形表示、型定義はコードブロック
  // ない場合は従来のフィールド表示にフォールバック
  let contentHtml = "";
  if (type.sourceCode) {
    // JSDoc部分と型定義部分を分離
    const { jsdocHtml, definitionCode } = splitTypeSourceCode(type.sourceCode);

    contentHtml = `
      ${jsdocHtml ? `<div class="type-description">${jsdocHtml}</div>` : ""}
      <pre class="code-block"><code class="language-ts">${escapeHtml(definitionCode)}</code></pre>
    `;
  } else {
    // フォールバック: フィールド一覧（interface/type用）
    if (type.fields && type.fields.length > 0) {
      const fieldsList = type.fields.slice(0, 8).map((f) => `
        <div class="type-field">
          <span class="field-name">${escapeHtml(f.name)}</span>
          <span class="field-type">${escapeHtml(f.type)}</span>
          ${f.description ? `<span class="field-desc">${escapeHtml(f.description)}</span>` : ""}
        </div>
      `).join("");
      const moreCount = type.fields.length > 8 ? type.fields.length - 8 : 0;
      contentHtml = `
        <div class="type-fields">
          ${fieldsList}
          ${moreCount > 0 ? `<div class="type-more">+${moreCount} more fields</div>` : ""}
        </div>
      `;
    }

    // フォールバック: 値一覧（enum用）
    if (type.values && type.values.length > 0) {
      const valuesList = type.values.slice(0, 10).map((v) => `<span class="enum-value">${escapeHtml(v)}</span>`).join("");
      const moreCount = type.values.length > 10 ? type.values.length - 10 : 0;
      contentHtml += `
        <div class="type-values">
          ${valuesList}
          ${moreCount > 0 ? `<span class="type-more">+${moreCount} more</span>` : ""}
        </div>
      `;
    }
  }

  return `
    <div class="type-item">
      <div class="type-header">
        <span class="type-name">${escapeHtml(type.name)}</span>
        <span class="type-badge badge-${badgeColor}">${type.kind}</span>
      </div>
      ${contentHtml}
    </div>
  `;
}

/**
 * ユーティリティアイテム（定数・関数）をHTMLで生成
 */
export function buildUtilityItem(util: UtilityItem): string {
  const kindBadgeColors: Record<string, string> = {
    constant: "yellow",
    function: "cyan",
  };
  const badgeColor = kindBadgeColors[util.kind] || "gray";

  // 定数の値表示
  let valueHtml = "";
  if (util.kind === "constant" && util.value) {
    valueHtml = `<code class="utility-value">${escapeHtml(util.value)}</code>`;
  }

  // 関数の引数表示
  let paramsHtml = "";
  if (util.kind === "function" && util.params && util.params.length > 0) {
    const paramsList = util.params.map((p) =>
      `<span class="param"><span class="param-name">${escapeHtml(p.name)}</span>: <span class="param-type">${escapeHtml(p.type)}</span></span>`
    ).join(", ");
    paramsHtml = `<div class="utility-params">(${paramsList})</div>`;
  }

  // 戻り値の型表示
  const returnTypeHtml = util.type ? `<span class="utility-return-type">: ${escapeHtml(util.type)}</span>` : "";

  return `
    <div class="utility-item">
      <div class="utility-header">
        <span class="utility-name">${escapeHtml(util.name)}</span>
        <span class="utility-badge badge-${badgeColor}">${util.kind}</span>
      </div>
      ${util.description ? `<p class="utility-description">${escapeHtml(util.description)}</p>` : ""}
      <div class="utility-signature">
        ${valueHtml}
        ${paramsHtml}
        ${returnTypeHtml}
      </div>
    </div>
  `;
}
