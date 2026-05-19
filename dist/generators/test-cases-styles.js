/**
 * test-cases スタイル・スクリプト・ユーティリティ
 *
 * テストケース HTML ページ用の CSS、JavaScript、
 * および共有ユーティリティ関数。
 */
import { basename } from "node:path";
// ============================================================
// Utility Functions (shared by generators)
// ============================================================
/**
 * ファイルパスを ID に変換
 */
export function fileToId(file) {
    return file.replace(/[^a-zA-Z0-9]/g, "-");
}
/**
 * 配列をキーでグループ化
 */
export function groupBy(array, keyFn) {
    const map = new Map();
    for (const item of array) {
        const key = keyFn(item);
        const existing = map.get(key) || [];
        existing.push(item);
        map.set(key, existing);
    }
    return map;
}
/**
 * カテゴリスラッグを生成
 */
export function categoryToSlug(category) {
    return category.toLowerCase().replace(/\s+/g, "-");
}
/**
 * ファイル名からスラッグを生成
 */
export function fileToSlug(file) {
    return basename(file)
        .replace(/\.test\.(ts|tsx)$/, "")
        .replace(/\.spec\.(ts|tsx|js)$/, "")
        .replace(/[^a-zA-Z0-9-]/g, "-");
}
/**
 * カテゴリ別のアイコンを取得
 */
export function getCategoryIcon(category) {
    switch (category) {
        case "Server Actions":
            return "⚡";
        case "Components":
            return "🧩";
        case "E2E":
            return "🎭";
        default:
            return "📄";
    }
}
/**
 * カテゴリ別の色クラスを取得
 */
export function getCategoryColor(category) {
    switch (category) {
        case "Server Actions":
            return "orange";
        case "Components":
            return "purple";
        case "E2E":
            return "green";
        default:
            return "gray";
    }
}
/**
 * テストカテゴリのバッジを生成
 */
export function getCategoryBadgeHtml(category, count) {
    if (count === 0)
        return "";
    const badges = {
        "happy-path": { icon: "✅", color: "#22c55e", label: "正常系" },
        auth: { icon: "🔐", color: "#f59e0b", label: "認証" },
        "error-handling": { icon: "❌", color: "#ef4444", label: "エラー処理" },
        validation: { icon: "📋", color: "#3b82f6", label: "バリデーション" },
        "edge-case": { icon: "🔍", color: "#8b5cf6", label: "境界値" },
        integration: { icon: "🔗", color: "#06b6d4", label: "統合" },
        other: { icon: "📝", color: "#6b7280", label: "その他" },
    };
    const badge = badges[category];
    return `<span class="test-category-badge" style="background: ${badge.color}20; color: ${badge.color}" title="${badge.label}">${badge.icon} ${count}</span>`;
}
/**
 * グローバルナビ用のHTML要素を取得
 * @param depth - ディレクトリ階層深度（1: test-cases/, 2: test-cases/category/）
 */
export function getGlobalNavElements(depth) {
    const prefix = "../".repeat(depth);
    return {
        headElements: `<link rel="stylesheet" href="${prefix}global-nav.css">`,
        bodyEndScripts: `<script src="${prefix}global-nav.js"></script>`,
    };
}
// ============================================================
// Sidebar Page Styles (single-page layout)
// ============================================================
/**
 * サイドバー用スタイル
 */
export function getSidebarStyles() {
    return `
    .main-container {
      display: flex;
      min-height: calc(100vh - 60px);
    }

    .sidebar {
      width: 280px;
      background: var(--card-bg);
      border-right: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      flex-shrink: 0;
    }

    .sidebar-header {
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    .sidebar-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
    }

    .nav-group {
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border-color);
    }

    .nav-group-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      font-size: 0.8rem;
    }

    .nav-list {
      list-style: none;
    }

    .nav-item {
      margin-bottom: 0.125rem;
    }

    .nav-link {
      display: block;
      padding: 0.375rem 0.75rem 0.375rem 1.5rem;
      color: var(--text-secondary);
      text-decoration: none;
      border-radius: 4px;
      font-size: 0.8rem;
      transition: all 0.15s ease;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .nav-link:hover {
      background: var(--border-color);
      color: var(--text-primary);
      text-decoration: none;
    }

    .badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-jest {
      background: rgba(153, 66, 91, 0.2);
      color: #c9425a;
    }

    .badge-playwright {
      background: rgba(46, 173, 51, 0.2);
      color: #2ead33;
    }

    .badge-count {
      color: var(--text-secondary);
      font-size: 0.75rem;
    }

    .content {
      flex: 1;
      padding: 2rem;
      max-width: 900px;
    }

    .summary-card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .summary-item {
      text-align: center;
      padding: 1rem;
      background: var(--bg-color);
      border-radius: 8px;
    }

    .summary-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .summary-label {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
    }

    .summary-jest .summary-value {
      color: #c9425a;
    }

    .summary-playwright .summary-value {
      color: #2ead33;
    }

    .summary-meta {
      text-align: right;
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .file-section {
      margin-bottom: 2rem;
      padding: 1rem;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }

    .file-path {
      flex: 1;
      font-size: 0.9rem;
      font-family: monospace;
      color: var(--accent-blue);
      margin: 0;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .test-count {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .describe-block {
      margin-left: 0.5rem;
      margin-bottom: 1rem;
    }

    .describe-title {
      font-size: 0.9rem;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
      padding-left: 0.5rem;
      border-left: 2px solid var(--accent-purple);
    }

    .describe-block.has-doc {
      background: rgba(168, 85, 247, 0.03);
      padding: 0.75rem;
      border-radius: 8px;
      border: 1px solid rgba(168, 85, 247, 0.1);
    }

    .describe-doc {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-bottom: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: rgba(168, 85, 247, 0.08);
      border-radius: 6px;
      margin-left: 0.5rem;
    }

    .describe-doc-text {
      font-size: 0.85rem;
      color: var(--text-primary);
      font-weight: 500;
    }

    .describe-doc-purpose {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .test-list {
      list-style: none;
      margin-left: 1rem;
    }

    .test-item {
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      border-radius: 6px;
      margin-bottom: 0.25rem;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }

    .test-item:hover {
      background: var(--bg-color);
      border-color: var(--border-color);
    }

    .test-item.has-details {
      background: rgba(168, 85, 247, 0.05);
      border-color: rgba(168, 85, 247, 0.2);
    }

    .test-item.has-japanese .test-name {
      color: var(--text-primary);
      font-weight: 500;
    }

    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .test-name {
      color: var(--text-secondary);
      flex: 1;
    }

    .test-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .test-line {
      font-size: 0.75rem;
      color: var(--text-secondary);
      opacity: 0.6;
      font-family: monospace;
    }

    .test-original {
      font-size: 0.65rem;
      padding: 0.125rem 0.375rem;
      background: rgba(59, 130, 246, 0.15);
      color: var(--accent-blue);
      border-radius: 3px;
      cursor: help;
      font-weight: 500;
    }

    .test-details {
      margin-top: 0.5rem;
      padding: 0.75rem;
      background: var(--bg-color);
      border-radius: 4px;
      font-size: 0.8rem;
    }

    .detail-item {
      padding: 0.25rem 0;
      color: var(--text-secondary);
      display: flex;
      gap: 0.5rem;
    }

    .detail-label {
      font-weight: 600;
      color: var(--accent-purple);
      min-width: 40px;
    }

    .detail-purpose { border-left: 2px solid var(--accent-green); padding-left: 0.5rem; }
    .detail-precondition { border-left: 2px solid var(--accent-orange); padding-left: 0.5rem; }
    .detail-expected { border-left: 2px solid var(--accent-blue); padding-left: 0.5rem; }

    /* BDD Annotations Styles */
    .test-item.has-bdd {
      background: rgba(34, 197, 94, 0.05);
      border-color: rgba(34, 197, 94, 0.2);
    }

    .test-bdd-badge {
      font-size: 0.6rem;
      padding: 0.125rem 0.375rem;
      background: rgba(34, 197, 94, 0.2);
      color: var(--accent-green);
      border-radius: 3px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .bdd-details {
      margin-top: 0.5rem;
      padding: 0.75rem;
      background: rgba(34, 197, 94, 0.05);
      border-radius: 6px;
      border: 1px solid rgba(34, 197, 94, 0.15);
      font-size: 0.85rem;
    }

    .bdd-item {
      padding: 0.375rem 0.5rem;
      margin-bottom: 0.25rem;
      border-radius: 4px;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .bdd-item:last-child {
      margin-bottom: 0;
    }

    .bdd-label {
      font-weight: 700;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      min-width: 50px;
      padding: 0.125rem 0.5rem;
      border-radius: 3px;
      text-align: center;
    }

    .bdd-given {
      background: rgba(59, 130, 246, 0.08);
    }

    .bdd-given .bdd-label {
      background: rgba(59, 130, 246, 0.2);
      color: var(--accent-blue);
    }

    .bdd-when {
      background: rgba(249, 115, 22, 0.08);
    }

    .bdd-when .bdd-label {
      background: rgba(249, 115, 22, 0.2);
      color: var(--accent-orange);
    }

    .bdd-then {
      background: rgba(34, 197, 94, 0.08);
    }

    .bdd-then .bdd-label {
      background: rgba(34, 197, 94, 0.2);
      color: var(--accent-green);
    }

    .bdd-and {
      background: rgba(168, 85, 247, 0.08);
    }

    .bdd-and .bdd-label {
      background: rgba(168, 85, 247, 0.2);
      color: var(--accent-purple);
    }

    .header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-secondary);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      transition: background 0.2s;
    }

    .back-link:hover {
      background: var(--border-color);
      color: var(--text-primary);
      text-decoration: none;
    }

    .search-box {
      flex: 1;
      max-width: 400px;
    }

    .search-input {
      width: 100%;
      padding: 0.5rem 1rem;
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 0.9rem;
    }

    .search-input::placeholder {
      color: var(--text-secondary);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--accent-blue);
    }

    .hidden {
      display: none !important;
    }

    /* Category Section Styles */
    .category-section {
      margin-bottom: 3rem;
    }

    .category-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid var(--border-color);
      color: var(--text-primary);
    }

    .category-icon {
      font-size: 1.25rem;
    }

    .category-count {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
      margin-left: auto;
    }

    /* Module Link Styles */
    .module-link {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      text-decoration: none;
      color: var(--text-secondary);
      font-size: 0.8rem;
      transition: all 0.15s ease;
    }

    .module-link:hover {
      border-color: var(--accent-blue);
      color: var(--accent-blue);
      text-decoration: none;
    }

    .module-badge {
      display: inline-block;
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .module-badge-action {
      background: rgba(59, 130, 246, 0.15);
      color: var(--accent-blue);
    }

    .module-badge-component {
      background: rgba(168, 85, 247, 0.15);
      color: var(--accent-purple);
    }

    .module-badge-screen {
      background: rgba(34, 197, 94, 0.15);
      color: var(--accent-green);
    }

    .module-unknown {
      color: var(--text-secondary);
      font-size: 0.8rem;
    }

    /* Updated File Header Styles */
    .file-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border-color);
      flex-wrap: wrap;
    }

    .file-header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
      min-width: 0;
    }

    .file-header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
    }

    /* Updated Sidebar Styles */
    .nav-category-icon {
      font-size: 1rem;
    }

    .nav-category-name {
      font-weight: 600;
      color: var(--text-primary);
    }

    .nav-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 3px;
      font-size: 0.6rem;
      font-weight: 700;
      margin-right: 0.375rem;
      flex-shrink: 0;
    }

    .nav-badge.badge-jest {
      background: rgba(153, 66, 91, 0.2);
      color: #c9425a;
    }

    .nav-badge.badge-playwright {
      background: rgba(46, 173, 51, 0.2);
      color: #2ead33;
    }

    @media (max-width: 768px) {
      .main-container {
        flex-direction: column;
      }

      .sidebar {
        width: 100%;
        height: auto;
        position: static;
      }

      .summary-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `;
}
/**
 * 検索スクリプト
 */
export function getSearchScript() {
    return `
    const searchInput = document.getElementById('searchInput');
    const fileSections = document.querySelectorAll('.file-section');
    const navItems = document.querySelectorAll('.nav-item');

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();

      fileSections.forEach((section, index) => {
        const text = section.textContent.toLowerCase();
        const isMatch = query === '' || text.includes(query);
        section.classList.toggle('hidden', !isMatch);
      });

      // サイドバーのナビアイテムも更新
      navItems.forEach((item) => {
        const link = item.querySelector('.nav-link');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!href) return;
        const sectionId = href.substring(1);
        const section = document.getElementById(sectionId);
        if (section) {
          item.classList.toggle('hidden', section.classList.contains('hidden'));
        }
      });
    });

    // スムーズスクロール
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        const target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  `;
}
// ============================================================
// Category List Page Styles (test-cases.html)
// ============================================================
/**
 * カテゴリ一覧ページのスタイル
 */
export function getCategoryListStyles() {
    return `
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-secondary);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      transition: background 0.2s;
    }

    .back-link:hover {
      background: var(--border-color);
      color: var(--text-primary);
      text-decoration: none;
    }

    .search-box {
      flex: 1;
      max-width: 400px;
    }

    .search-input {
      width: 100%;
      padding: 0.5rem 1rem;
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
    }

    .page-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .page-header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .page-stats {
      color: var(--text-secondary);
      font-size: 1.1rem;
    }

    .category-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .category-card {
      display: block;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      text-decoration: none;
      transition: all 0.2s;
    }

    .category-card:hover {
      border-color: var(--accent-blue);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      text-decoration: none;
    }

    .category-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .category-name {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.75rem;
    }

    .category-stats {
      display: flex;
      gap: 1rem;
      font-size: 0.9rem;
      color: var(--text-secondary);
      margin-bottom: 0.75rem;
    }

    .category-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .test-category-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .category-orange { border-left: 4px solid #f97316; }
    .category-purple { border-left: 4px solid #a855f7; }
    .category-green { border-left: 4px solid #22c55e; }
    .category-gray { border-left: 4px solid #6b7280; }

    .summary-meta {
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-top: 2rem;
    }

    @media (max-width: 768px) {
      .category-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
}
// ============================================================
// File List Page Styles (test-cases/{category}.html)
// ============================================================
/**
 * ファイル一覧ページのスタイル
 */
export function getFileListStyles() {
    return `
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }

    .header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 2rem;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-secondary);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      transition: background 0.2s;
    }

    .back-link:hover {
      background: var(--border-color);
      color: var(--text-primary);
      text-decoration: none;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
    }

    .breadcrumb a {
      color: var(--accent-blue);
      text-decoration: none;
    }

    .breadcrumb a:hover {
      text-decoration: underline;
    }

    .breadcrumb .separator {
      color: var(--text-secondary);
    }

    .breadcrumb .current {
      color: var(--text-primary);
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-header h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .page-stats {
      color: var(--text-secondary);
    }

    .file-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .file-card {
      display: block;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      text-decoration: none;
      transition: all 0.2s;
    }

    .file-card:hover {
      border-color: var(--accent-blue);
      text-decoration: none;
    }

    .file-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .file-name {
      font-weight: 600;
      color: var(--text-primary);
      font-family: monospace;
    }

    .test-count {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .file-desc {
      font-size: 0.9rem;
      color: var(--text-secondary);
      margin-bottom: 0.75rem;
    }

    .file-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }

    .module-link {
      font-size: 0.8rem;
      color: var(--accent-blue);
      text-decoration: none;
    }

    .module-link:hover {
      text-decoration: underline;
    }

    .category-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .test-category-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }
  `;
}
// ============================================================
// Test Detail Page Styles (test-cases/{category}/{file}.html)
// ============================================================
/**
 * テスト詳細ページのスタイル
 */
export function getTestDetailStyles() {
    return `
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }

    .header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 2rem;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-secondary);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      transition: background 0.2s;
    }

    .back-link:hover {
      background: var(--border-color);
      color: var(--text-primary);
      text-decoration: none;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
    }

    .breadcrumb a {
      color: var(--accent-blue);
      text-decoration: none;
    }

    .breadcrumb a:hover {
      text-decoration: underline;
    }

    .breadcrumb .separator {
      color: var(--text-secondary);
    }

    .breadcrumb .current {
      color: var(--text-primary);
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-header h1 {
      font-size: 1.75rem;
      font-weight: 700;
      font-family: monospace;
      margin-bottom: 0.5rem;
    }

    .file-desc {
      color: var(--text-secondary);
      margin-bottom: 0.75rem;
    }

    .module-link-large {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 6px;
      color: var(--accent-blue);
      text-decoration: none;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .module-link-large:hover {
      background: rgba(59, 130, 246, 0.2);
      border-color: var(--accent-blue);
      text-decoration: none;
    }

    .test-groups {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .test-group {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.25rem;
    }

    .group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border-color);
    }

    .group-name {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .group-count {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .group-desc {
      font-size: 0.9rem;
      color: var(--text-secondary);
      margin-bottom: 1rem;
      padding: 0.5rem 0.75rem;
      background: rgba(168, 85, 247, 0.08);
      border-radius: 6px;
    }

    .test-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .test-item {
      padding: 0.75rem;
      border-radius: 6px;
      border: 1px solid transparent;
      transition: all 0.15s;
    }

    .test-item:hover {
      background: var(--bg-color);
      border-color: var(--border-color);
    }

    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .test-name {
      font-size: 0.9rem;
      color: var(--text-primary);
      font-weight: 500;
    }

    .test-line {
      font-size: 0.75rem;
      color: var(--text-secondary);
      font-family: monospace;
    }

    .test-original {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
    }

    .test-details {
      margin-top: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--bg-color);
      border-radius: 4px;
      font-size: 0.85rem;
    }

    .detail-item {
      padding: 0.25rem 0;
      color: var(--text-secondary);
    }

    .detail-label {
      font-weight: 600;
      color: var(--accent-purple);
    }

    .test-category {
      margin-top: 0.5rem;
    }

    .test-category-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }
  `;
}
//# sourceMappingURL=test-cases-styles.js.map