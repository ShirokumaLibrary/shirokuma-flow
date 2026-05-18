/**
 * HTML 生成ユーティリティ
 */

import Handlebars from "handlebars";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * ダークテーマ CSS 変数
 */
export const darkThemeCssVars = `
:root {
  --bg-color: #0a0a0a;
  --card-bg: #141414;
  --border-color: #262626;
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --accent-blue: #3b82f6;
  --accent-green: #22c55e;
  --accent-purple: #a855f7;
  --accent-orange: #f97316;
  --accent-pink: #ec4899;
  --code-bg: #1e1e1e;
  --sidebar-width: 280px;
}
`;

/**
 * 基本リセット CSS
 */
export const resetCss = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--bg-color);
  color: var(--text-primary);
  min-height: 100vh;
  line-height: 1.6;
}

a {
  color: var(--accent-blue);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
`;

/**
 * カードコンポーネント CSS
 */
export const cardCss = `
.card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  transition: border-color 0.2s, transform 0.2s;
}

.card:hover {
  border-color: var(--text-secondary);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.card-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.icon-blue { background: rgba(59, 130, 246, 0.2); color: var(--accent-blue); }
.icon-green { background: rgba(34, 197, 94, 0.2); color: var(--accent-green); }
.icon-purple { background: rgba(168, 85, 247, 0.2); color: var(--accent-purple); }
.icon-orange { background: rgba(249, 115, 22, 0.2); color: var(--accent-orange); }
.icon-pink { background: rgba(236, 72, 153, 0.2); color: var(--accent-pink); }

.card h2 {
  font-size: 1.25rem;
  font-weight: 600;
}

.card p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.6;
  margin-bottom: 1rem;
}
`;

/**
 * グリッドレイアウト CSS
 */
export const gridCss = `
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}
`;

/**
 * リンクボタン CSS
 */
export const linkCss = `
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 0.85rem;
  transition: background 0.2s, border-color 0.2s;
}

.link:hover {
  background: var(--border-color);
  border-color: var(--text-secondary);
  text-decoration: none;
}

.link svg {
  width: 14px;
  height: 14px;
}
`;

/**
 * ヘッダー CSS（global-header, hero は除外）
 */
export const headerCss = `
header:not(.global-header):not(.hero) {
  text-align: center;
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--border-color);
}

header:not(.global-header):not(.hero) h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

header:not(.global-header):not(.hero) .subtitle {
  color: var(--text-secondary);
  font-size: 1.1rem;
}
`;

/**
 * フッター CSS
 */
export const footerCss = `
footer {
  text-align: center;
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.9rem;
}
`;

/**
 * セクションタイトル CSS
 */
export const sectionCss = `
.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
`;

/**
 * ページヘッダー CSS (db-schema パターン)
 */
export const pageHeaderCss = `
.page-header {
  margin-bottom: 2rem;
  text-align: center;
}

.page-title {
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
}

.page-description {
  font-size: 1rem;
  color: var(--text-secondary);
  max-width: 600px;
  margin: 0 auto;
}

.page-meta {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
}

.page-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 0.5rem;
  vertical-align: middle;
}

.page-badge.badge-action { background: rgba(59, 130, 246, 0.2); color: var(--accent-blue); }
.page-badge.badge-screen { background: rgba(34, 197, 94, 0.2); color: var(--accent-green); }
.page-badge.badge-component { background: rgba(168, 85, 247, 0.2); color: var(--accent-purple); }
.page-badge.badge-table { background: rgba(249, 115, 22, 0.2); color: var(--accent-orange); }

.page-module-prefix {
  color: var(--text-secondary);
  font-weight: 400;
}
`;

/**
 * 全てのスタイルを結合
 */
export function getAllStyles(): string {
  return [
    darkThemeCssVars,
    resetCss,
    gridCss,
    cardCss,
    linkCss,
    headerCss,
    footerCss,
    sectionCss,
    pageHeaderCss,
  ].join("\n");
}

/**
 * HTML ドキュメントをラップ
 *
 * **セキュリティ注意**: `styles` と `scripts` は内部生成の値のみ使用すること。
 * ユーザー入力を含めた場合、`</style>` / `</script>` によるコンテキストブレイクアウトのリスクがある。
 */
export function wrapHtmlDocument(options: {
  title: string;
  content: string;
  /** 内部生成の CSS のみ。ユーザー入力を含めないこと */
  styles?: string;
  /** 内部生成の JavaScript のみ。ユーザー入力を含めないこと */
  scripts?: string;
  lang?: string;
  /** head内に追加する外部リソース（link, script タグ） */
  headElements?: string;
  /** body末尾に追加するスクリプト（script タグ） */
  bodyEndScripts?: string;
}): string {
  const {
    title,
    content,
    styles = "",
    scripts = "",
    lang = "ja",
    headElements = "",
    bodyEndScripts = "",
  } = options;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
${getAllStyles()}
${styles}
  </style>
${headElements}
</head>
<body>
${content}
${scripts ? `<script>${scripts}</script>` : ""}
${bodyEndScripts}
</body>
</html>`;
}

/**
 * HTML エスケープ
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}

/**
 * 説明文をHTMLフォーマット
 * - HTMLエスケープ
 * - 改行を <br> に変換
 * - 先頭インデントを保持（&nbsp;）
 */
export function formatDescription(text: string): string {
  return escapeHtml(text)
    .split("\n")
    .map((line) => {
      // 先頭の空白をnbspに変換して保持
      const match = line.match(/^(\s+)/);
      if (match) {
        const spaces = match[1].replace(/ /g, "&nbsp;");
        return spaces + line.trimStart();
      }
      return line;
    })
    .join("<br>");
}

/**
 * SVG アイコン
 */
export const icons = {
  database: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  book: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`,
  code: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  grid: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  file: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
  external: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  image: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
  settings: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  back: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
  menu: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>`,
  // Feature map specific icons
  tree: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 12h4v5H7z"/><path d="M15 8h4v9h-4z"/></svg>`,
  graph: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v6"/><path d="M9 18h6"/><path d="M18 15V9a3 3 0 0 0-3-3H9"/></svg>`,
  expandAll: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/></svg>`,
  collapseAll: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 8 5 5 5-5"/><path d="m7 16 5-5 5 5"/></svg>`,
  download: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  screen: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  component: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704l1.611-1.611c.276-.276.649-.366.837-.276.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61-1.61a2.404 2.404 0 0 1 1.705-.707c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/></svg>`,
  action: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  table: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  feature: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
  chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`,
  chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`,
  // Overview specific icons
  layers: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
};

/**
 * Handlebars テンプレートをコンパイル
 */
export function compileTemplate(template: string): Handlebars.TemplateDelegate {
  return Handlebars.compile(template);
}

/**
 * テンプレートファイルを読み込んでコンパイル
 */
export function loadTemplate(templatePath: string): Handlebars.TemplateDelegate {
  const fullPath = resolve(__dirname, "../../templates", templatePath);

  if (!existsSync(fullPath)) {
    throw new Error(`テンプレートが見つかりません: ${fullPath}`);
  }

  const content = readFileSync(fullPath, "utf-8");
  return compileTemplate(content);
}
