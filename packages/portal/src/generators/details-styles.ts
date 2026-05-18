/**
 * details-styles - CSS・スクリプト・URLユーティリティ
 *
 * 詳細ページ用のスタイル、スクリプト、テストページURLユーティリティを提供する。
 */

import { basename } from "node:path";
import type { TestCategory } from "../commands/details-types.js";

// ===== テストページ URL ユーティリティ =====

/**
 * テストファイルパスからtest-cases.htmlのアンカーIDを生成
 */
export function generateTestCaseAnchorId(file: string, framework: "jest" | "playwright"): string {
  const fileId = file.replace(/[^a-zA-Z0-9]/g, "-");
  return `${framework}-${fileId}`;
}

/**
 * テストファイルのカテゴリを判定
 */
export function getTestFileCategory(file: string, framework: "jest" | "playwright"): string {
  if (framework === "playwright") {
    return "E2E";
  }
  if (file.includes("__tests__/lib/actions/") || file.includes("/lib/actions/")) {
    return "Server Actions";
  }
  if (file.includes("__tests__/components/") || file.includes("/components/")) {
    return "Components";
  }
  return "Other";
}

/**
 * カテゴリからスラッグを生成
 */
export function testCategoryToSlug(category: string): string {
  return category.toLowerCase().replace(/\s+/g, "-");
}

/**
 * テストファイル名からスラッグを生成
 */
export function testFileToSlug(file: string): string {
  return basename(file)
    .replace(/\.test\.(ts|tsx)$/, "")
    .replace(/\.spec\.(ts|tsx|js)$/, "");
}

/**
 * テストファイルから3階層URL（相対パス）を生成
 */
export function generateTestPageUrl(file: string, framework: "jest" | "playwright", depth: number): string {
  const category = getTestFileCategory(file, framework);
  const categorySlug = testCategoryToSlug(category);
  const fileSlug = testFileToSlug(file);
  const prefix = "../".repeat(depth);
  return `${prefix}test-cases/${categorySlug}/${fileSlug}.html`;
}

// ===== カテゴリラベル =====

export const categoryLabels: Record<TestCategory, { label: string; icon: string; color: string }> = {
  "happy-path": { label: "正常系", icon: "✅", color: "#22c55e" },
  "error-handling": { label: "エラー処理", icon: "❌", color: "#ef4444" },
  auth: { label: "認証・認可", icon: "🔐", color: "#f59e0b" },
  validation: { label: "バリデーション", icon: "📋", color: "#3b82f6" },
  "edge-case": { label: "境界値", icon: "🔍", color: "#8b5cf6" },
  integration: { label: "統合", icon: "🔗", color: "#06b6d4" },
  other: { label: "その他", icon: "📝", color: "#6b7280" },
};

// ===== CDN スクリプト =====

/**
 * CDN スクリプトタグ + グローバルナビ
 */
export function getCdnScripts(): string {
  return `
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css">
    <link rel="stylesheet" href="/global-nav.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/typescript.min.js"></script>
    <script>document.addEventListener('DOMContentLoaded', () => hljs.highlightAll());</script>
    <script src="/global-nav.js"></script>
  `;
}

// ===== JavaScript =====

export function getDetailScripts(): string {
  return `
    function showTab(tabId) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      document.querySelector(\`[onclick="showTab('\${tabId}')"]\`).classList.add('active');
      document.getElementById(tabId).classList.add('active');
    }

    // highlight.js 初期化
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof hljs !== 'undefined') {
        document.querySelectorAll('pre code').forEach(block => {
          hljs.highlightElement(block);
        });
      }
    });
  `;
}

// ===== 詳細ページスタイル =====

export function getDetailStyles(accentColor: string): string {
  const colorVars: Record<string, string> = {
    blue: "var(--accent-blue)",
    green: "var(--accent-green)",
    orange: "var(--accent-orange)",
    pink: "var(--accent-pink)",
  };
  const accent = colorVars[accentColor] || "var(--accent-blue)";

  return `
    .detail-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    /* パンくずナビゲーション */
    .breadcrumb { margin-bottom: 1.5rem; }
    .breadcrumb ol {
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
      list-style: none; padding: 0; margin: 0; font-size: 0.875rem;
    }
    .breadcrumb li { display: flex; align-items: center; }
    .breadcrumb a { color: var(--accent-blue); text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .breadcrumb li[aria-current="page"] { color: var(--text-primary); font-weight: 500; }
    .breadcrumb-module {
      color: var(--accent-blue); font-family: monospace;
      background: var(--bg-color); padding: 0.125rem 0.5rem;
      border-radius: 4px; border: 1px solid var(--border-color);
      text-decoration: none; transition: all 0.15s;
    }
    .breadcrumb-module:hover {
      background: rgba(59, 130, 246, 0.1);
      border-color: var(--accent-blue); text-decoration: none;
    }

    .detail-header { margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); }
    .detail-title {
      font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem;
      display: flex; align-items: center; flex-wrap: wrap; gap: 0.75rem;
    }
    .detail-module-prefix { color: var(--text-secondary); font-weight: 400; font-size: 1.25rem; }
    .detail-badge { font-size: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: 600; }

    .badge-blue { background: rgba(59, 130, 246, 0.2); color: var(--accent-blue); }
    .badge-green { background: rgba(34, 197, 94, 0.2); color: var(--accent-green); }
    .badge-orange { background: rgba(249, 115, 22, 0.2); color: var(--accent-orange); }
    .badge-pink { background: rgba(236, 72, 153, 0.2); color: var(--accent-pink); }
    .badge-teal { background: rgba(20, 184, 166, 0.2); color: #14b8a6; }
    .badge-purple { background: rgba(168, 85, 247, 0.2); color: #a855f7; }
    .badge-yellow { background: rgba(234, 179, 8, 0.2); color: #eab308; }
    .badge-cyan { background: rgba(6, 182, 212, 0.2); color: #06b6d4; }

    .detail-path, .detail-route { font-size: 0.9rem; color: var(--text-secondary); font-family: monospace; }

    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); }
    .tab {
      padding: 0.75rem 1.5rem; background: transparent; border: none;
      color: var(--text-secondary); cursor: pointer; font-size: 0.9rem;
      border-bottom: 2px solid transparent;
    }
    .tab:hover { color: var(--text-primary); }
    .tab.active { color: ${accent}; border-bottom-color: ${accent}; }

    .tab-content { display: none; }
    .tab-content.active { display: block; }

    .section {
      background: var(--card-bg); border: 1px solid var(--border-color);
      border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;
    }
    .section-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; }

    .code-block {
      background: var(--code-bg); border-radius: 8px; padding: 1rem;
      overflow-x: auto; margin: 1rem 0; border: 1px solid var(--border-color);
    }
    .code-block code { font-family: 'SF Mono', Consolas, monospace; font-size: 0.85rem; line-height: 1.6; }

    /* マークダウンコンテンツ */
    .markdown-content p { margin: 0.75rem 0; line-height: 1.7; }
    .markdown-content p:first-child { margin-top: 0; }
    .markdown-content code {
      background: rgba(255, 255, 255, 0.1); padding: 0.15rem 0.4rem;
      border-radius: 4px; font-family: 'SF Mono', Consolas, monospace;
      font-size: 0.9em; color: var(--accent-green);
    }
    .markdown-content .code-block code { background: transparent; padding: 0; color: var(--text-primary); }

    /* パラメータテーブル */
    .params-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .params-table th, .params-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--border-color); }
    .params-table th { color: var(--text-secondary); font-weight: 500; font-size: 0.8rem; text-transform: uppercase; }
    .params-table td code {
      background: rgba(255, 255, 255, 0.1); padding: 0.15rem 0.4rem;
      border-radius: 4px; font-family: 'SF Mono', Consolas, monospace; font-size: 0.85em;
    }

    /* 例外リスト */
    .throws-list { list-style: none; padding: 0; }
    .throws-list li { padding: 0.5rem 0; padding-left: 1.5rem; position: relative; }
    .throws-list li::before { content: "⚠️"; position: absolute; left: 0; }

    /* メタ情報タグ */
    .meta-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .meta-tag {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 1rem; background: var(--bg-color);
      border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.85rem;
    }
    .meta-tag-name { font-weight: 500; }

    /* テストセクション */
    .coverage-score { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .score-bar { flex: 1; height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden; }
    .score-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
    .score-value { font-weight: 600; font-size: 1.1rem; }

    .category-summary { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
    .category-badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 500; }

    .missing-patterns {
      background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 1rem; border-radius: 8px; margin-top: 1rem;
    }
    .missing-badge {
      display: inline-block; background: rgba(239, 68, 68, 0.2); color: #ef4444;
      padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.8rem; margin-left: 0.5rem;
    }

    .test-category { margin-bottom: 1.5rem; }
    .category-header { font-size: 1rem; padding-left: 0.75rem; border-left: 3px solid; margin-bottom: 0.75rem; }
    .test-list { list-style: none; }
    .test-item {
      background: var(--bg-color); border: 1px solid var(--border-color);
      border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem;
    }
    .test-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .test-name { font-weight: 500; color: var(--text-primary); }
    .test-meta { font-size: 0.75rem; color: var(--text-secondary); font-family: monospace; }
    .test-original { font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem; }
    .test-detail { font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem; }
    .test-bdd { margin-top: 0.75rem; padding: 0.75rem; background: rgba(34, 197, 94, 0.05); border-radius: 6px; }
    .bdd-item { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.25rem; font-size: 0.85rem; }
    .bdd-label {
      font-weight: 600; font-size: 0.7rem; padding: 0.125rem 0.5rem;
      border-radius: 3px; background: rgba(34, 197, 94, 0.2); color: var(--accent-green);
    }
    .test-file { font-size: 0.75rem; color: var(--text-secondary); font-family: monospace; margin-top: 0.5rem; }
    .test-file-link {
      display: inline-block; font-size: 0.75rem; color: var(--accent-blue);
      font-family: monospace; margin-top: 0.5rem; padding: 0.25rem 0.5rem;
      background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 4px; text-decoration: none; transition: all 0.15s;
    }
    .test-file-link:hover {
      background: rgba(59, 130, 246, 0.2); border-color: var(--accent-blue); text-decoration: none;
    }

    .no-tests { text-align: center; padding: 2rem; color: var(--text-secondary); }
    .recommendations { text-align: left; margin-top: 1rem; padding-left: 1.5rem; }

    /* 関連要素 */
    .related-group { margin-bottom: 1.5rem; }
    .related-group h4 { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.75rem; }
    .related-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .related-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.75rem 1rem; background: var(--bg-color);
      border: 1px solid var(--border-color); border-radius: 6px;
      color: var(--text-primary); transition: all 0.2s;
    }
    .related-item:hover { border-color: ${accent}; transform: translateX(4px); text-decoration: none; }
    .related-item-name { font-weight: 500; }
    .related-item-module {
      font-size: 0.75rem; color: var(--text-secondary); font-family: monospace;
      background: rgba(255, 255, 255, 0.05); padding: 0.125rem 0.5rem; border-radius: 4px;
    }
    .related-item-nolink { cursor: default; opacity: 0.7; }
    .related-item-nolink:hover { border-color: var(--border-color); transform: none; }
  `;
}

// ===== モジュールページ固有スタイル =====

export function getModuleSpecificStyles(accentColor: string): string {
  const colorVars: Record<string, string> = {
    blue: "var(--accent-blue)",
    green: "var(--accent-green)",
    orange: "var(--accent-orange)",
    pink: "var(--accent-pink)",
  };
  const accent = colorVars[accentColor] || "var(--accent-blue)";

  return `
    /* モジュールページ固有スタイル */
    .module-description { color: var(--text-secondary); font-size: 1rem; line-height: 1.6; margin-top: 0.75rem; }

    .module-stats { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; }
    .stat-item {
      display: flex; flex-direction: column; align-items: center;
      padding: 1rem 1.5rem; background: var(--bg-color);
      border: 1px solid var(--border-color); border-radius: 8px; min-width: 100px;
    }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: ${accent}; }
    .stat-label { font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem; }

    .module-items-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .module-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.875rem 1rem; background: var(--bg-color);
      border: 1px solid var(--border-color); border-radius: 8px;
      text-decoration: none; color: inherit; transition: all 0.15s;
    }
    .module-item:hover { border-color: ${accent}; background: rgba(59, 130, 246, 0.05); text-decoration: none; }
    .module-item-main { display: flex; flex-direction: column; gap: 0.25rem; }
    .module-item-name { font-weight: 500; font-family: monospace; color: var(--text-primary); }
    .module-item-desc { font-size: 0.8rem; color: var(--text-secondary); }
    .module-item-meta { display: flex; align-items: center; gap: 0.5rem; }

    .item-route {
      font-size: 0.7rem; padding: 0.125rem 0.5rem; background: rgba(59, 130, 246, 0.15);
      color: #3b82f6; border-radius: 4px; font-family: monospace;
    }
    .item-meta { font-size: 0.75rem; color: var(--text-secondary); }
    .empty-message { padding: 2rem; text-align: center; color: var(--text-secondary); }

    /* Types & Utilities リスト */
    .types-list, .utilities-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .type-item, .utility-item {
      background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;
    }
    .type-header, .utility-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
    .type-name, .utility-name { font-weight: 600; font-family: monospace; color: ${accent}; }
    .type-kind {
      font-size: 0.7rem; padding: 0.125rem 0.5rem; background: var(--border-color);
      border-radius: 4px; color: var(--text-secondary);
    }
    .type-description { font-size: 0.85rem; color: var(--text-secondary); margin: 0.5rem 0; line-height: 1.5; }

    .type-fields { display: flex; flex-direction: column; gap: 0.375rem; margin-top: 0.75rem; }
    .type-field {
      display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.85rem;
      padding: 0.25rem 0; border-bottom: 1px solid var(--border-color);
    }
    .type-field:last-child { border-bottom: none; }
    .field-name { font-family: monospace; color: var(--text-primary); min-width: 120px; }
    .field-type { font-family: monospace; color: ${accent}; font-size: 0.8rem; }
    .field-desc { color: var(--text-secondary); font-size: 0.8rem; margin-left: auto; }

    .enum-values { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.5rem; }
    .enum-value {
      font-family: monospace; font-size: 0.75rem; padding: 0.125rem 0.5rem;
      background: rgba(34, 197, 94, 0.15); color: var(--accent-green); border-radius: 4px;
    }
    .enum-more { font-size: 0.75rem; color: var(--text-secondary); }
    .type-more { font-size: 0.75rem; color: var(--text-secondary); font-style: italic; }

    .utility-description { font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem; }
    .utility-value {
      font-family: monospace; font-size: 0.85rem; background: var(--card-bg);
      padding: 0.125rem 0.5rem; border-radius: 4px;
    }
    .utility-params { display: flex; gap: 0.25rem; }
    .param { font-family: monospace; font-size: 0.8rem; }
    .param-name { color: var(--text-primary); }
    .param-type { color: ${accent}; }
    .utility-return-type { font-family: monospace; font-size: 0.8rem; color: ${accent}; }

    @media (max-width: 768px) {
      .module-stats { flex-wrap: wrap; }
      .stat-item { flex: 1; min-width: 80px; padding: 0.75rem 1rem; }
      .type-field { flex-direction: column; gap: 0.125rem; }
      .field-name { min-width: auto; }
      .field-desc { margin-left: 0; }
    }

    /* Module Tests List Styles */
    .module-tests-list { display: flex; flex-direction: column; gap: 1rem; }
    .module-test-file-section {
      background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;
    }
    .module-test-file-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.75rem 1rem; background: rgba(59, 130, 246, 0.05);
      border-bottom: 1px solid var(--border-color);
    }
    .module-test-file-link {
      font-family: monospace; font-size: 0.9rem; font-weight: 500;
      color: var(--accent-blue); text-decoration: none;
    }
    .module-test-file-link:hover { text-decoration: underline; }
    .module-test-file-meta { display: flex; align-items: center; gap: 0.5rem; }
    .module-test-count { font-size: 0.8rem; color: var(--text-secondary); }
    .module-test-category {
      font-size: 0.7rem; padding: 0.125rem 0.375rem; border-radius: 4px; font-weight: 500;
    }
    .module-test-items { padding: 0.5rem; }
    .module-test-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.5rem 0.75rem; border-radius: 4px;
    }
    .module-test-item:hover { background: rgba(255, 255, 255, 0.03); }
    .module-test-name { font-size: 0.85rem; color: var(--text-primary); }
    .module-test-line { font-size: 0.75rem; font-family: monospace; color: var(--text-secondary); }
    .module-test-more {
      display: block; text-align: center; padding: 0.5rem; font-size: 0.8rem;
      color: var(--accent-blue); text-decoration: none; border-top: 1px solid var(--border-color);
    }
    .module-test-more:hover { background: rgba(59, 130, 246, 0.1); text-decoration: none; }
  `;
}
