/**
 * HTML 生成ユーティリティ
 */
import Handlebars from "handlebars";
/**
 * ダークテーマ CSS 変数
 */
export declare const darkThemeCssVars = "\n:root {\n  --bg-color: #0a0a0a;\n  --card-bg: #141414;\n  --border-color: #262626;\n  --text-primary: #fafafa;\n  --text-secondary: #a1a1aa;\n  --accent-blue: #3b82f6;\n  --accent-green: #22c55e;\n  --accent-purple: #a855f7;\n  --accent-orange: #f97316;\n  --accent-pink: #ec4899;\n  --code-bg: #1e1e1e;\n  --sidebar-width: 280px;\n}\n";
/**
 * 基本リセット CSS
 */
export declare const resetCss = "\n* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;\n  background: var(--bg-color);\n  color: var(--text-primary);\n  min-height: 100vh;\n  line-height: 1.6;\n}\n\na {\n  color: var(--accent-blue);\n  text-decoration: none;\n}\n\na:hover {\n  text-decoration: underline;\n}\n";
/**
 * カードコンポーネント CSS
 */
export declare const cardCss = "\n.card {\n  background: var(--card-bg);\n  border: 1px solid var(--border-color);\n  border-radius: 12px;\n  padding: 1.5rem;\n  transition: border-color 0.2s, transform 0.2s;\n}\n\n.card:hover {\n  border-color: var(--text-secondary);\n  transform: translateY(-2px);\n}\n\n.card-header {\n  display: flex;\n  align-items: center;\n  gap: 0.75rem;\n  margin-bottom: 1rem;\n}\n\n.card-icon {\n  width: 40px;\n  height: 40px;\n  border-radius: 8px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-size: 1.25rem;\n}\n\n.icon-blue { background: rgba(59, 130, 246, 0.2); color: var(--accent-blue); }\n.icon-green { background: rgba(34, 197, 94, 0.2); color: var(--accent-green); }\n.icon-purple { background: rgba(168, 85, 247, 0.2); color: var(--accent-purple); }\n.icon-orange { background: rgba(249, 115, 22, 0.2); color: var(--accent-orange); }\n.icon-pink { background: rgba(236, 72, 153, 0.2); color: var(--accent-pink); }\n\n.card h2 {\n  font-size: 1.25rem;\n  font-weight: 600;\n}\n\n.card p {\n  color: var(--text-secondary);\n  font-size: 0.9rem;\n  line-height: 1.6;\n  margin-bottom: 1rem;\n}\n";
/**
 * グリッドレイアウト CSS
 */
export declare const gridCss = "\n.container {\n  max-width: 1200px;\n  margin: 0 auto;\n  padding: 2rem;\n}\n\n.grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));\n  gap: 1.5rem;\n  margin-bottom: 3rem;\n}\n";
/**
 * リンクボタン CSS
 */
export declare const linkCss = "\n.links {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 0.5rem;\n}\n\n.link {\n  display: inline-flex;\n  align-items: center;\n  gap: 0.25rem;\n  padding: 0.5rem 0.75rem;\n  background: var(--bg-color);\n  border: 1px solid var(--border-color);\n  border-radius: 6px;\n  color: var(--text-primary);\n  text-decoration: none;\n  font-size: 0.85rem;\n  transition: background 0.2s, border-color 0.2s;\n}\n\n.link:hover {\n  background: var(--border-color);\n  border-color: var(--text-secondary);\n  text-decoration: none;\n}\n\n.link svg {\n  width: 14px;\n  height: 14px;\n}\n";
/**
 * ヘッダー CSS（global-header, hero は除外）
 */
export declare const headerCss = "\nheader:not(.global-header):not(.hero) {\n  text-align: center;\n  margin-bottom: 3rem;\n  padding-bottom: 2rem;\n  border-bottom: 1px solid var(--border-color);\n}\n\nheader:not(.global-header):not(.hero) h1 {\n  font-size: 2.5rem;\n  font-weight: 700;\n  margin-bottom: 0.5rem;\n}\n\nheader:not(.global-header):not(.hero) .subtitle {\n  color: var(--text-secondary);\n  font-size: 1.1rem;\n}\n";
/**
 * フッター CSS
 */
export declare const footerCss = "\nfooter {\n  text-align: center;\n  margin-top: 3rem;\n  padding-top: 2rem;\n  border-top: 1px solid var(--border-color);\n  color: var(--text-secondary);\n  font-size: 0.9rem;\n}\n";
/**
 * セクションタイトル CSS
 */
export declare const sectionCss = "\n.section-title {\n  font-size: 1.1rem;\n  font-weight: 600;\n  margin-bottom: 1rem;\n  color: var(--text-secondary);\n  text-transform: uppercase;\n  letter-spacing: 0.05em;\n}\n";
/**
 * ページヘッダー CSS (db-schema パターン)
 */
export declare const pageHeaderCss = "\n.page-header {\n  margin-bottom: 2rem;\n  text-align: center;\n}\n\n.page-title {\n  font-size: 2rem;\n  font-weight: 800;\n  margin-bottom: 0.5rem;\n}\n\n.page-description {\n  font-size: 1rem;\n  color: var(--text-secondary);\n  max-width: 600px;\n  margin: 0 auto;\n}\n\n.page-meta {\n  font-size: 0.875rem;\n  color: var(--text-secondary);\n  margin-top: 0.5rem;\n}\n\n.page-badge {\n  display: inline-block;\n  padding: 0.25rem 0.75rem;\n  border-radius: 9999px;\n  font-size: 0.75rem;\n  font-weight: 600;\n  margin-left: 0.5rem;\n  vertical-align: middle;\n}\n\n.page-badge.badge-action { background: rgba(59, 130, 246, 0.2); color: var(--accent-blue); }\n.page-badge.badge-screen { background: rgba(34, 197, 94, 0.2); color: var(--accent-green); }\n.page-badge.badge-component { background: rgba(168, 85, 247, 0.2); color: var(--accent-purple); }\n.page-badge.badge-table { background: rgba(249, 115, 22, 0.2); color: var(--accent-orange); }\n\n.page-module-prefix {\n  color: var(--text-secondary);\n  font-weight: 400;\n}\n";
/**
 * 全てのスタイルを結合
 */
export declare function getAllStyles(): string;
/**
 * HTML ドキュメントをラップ
 *
 * **セキュリティ注意**: `styles` と `scripts` は内部生成の値のみ使用すること。
 * ユーザー入力を含めた場合、`</style>` / `</script>` によるコンテキストブレイクアウトのリスクがある。
 */
export declare function wrapHtmlDocument(options: {
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
}): string;
/**
 * HTML エスケープ
 */
export declare function escapeHtml(text: string): string;
/**
 * 説明文をHTMLフォーマット
 * - HTMLエスケープ
 * - 改行を <br> に変換
 * - 先頭インデントを保持（&nbsp;）
 */
export declare function formatDescription(text: string): string;
/**
 * SVG アイコン
 */
export declare const icons: {
    database: string;
    check: string;
    book: string;
    code: string;
    grid: string;
    file: string;
    external: string;
    image: string;
    settings: string;
    back: string;
    menu: string;
    tree: string;
    graph: string;
    expandAll: string;
    collapseAll: string;
    download: string;
    screen: string;
    component: string;
    action: string;
    table: string;
    feature: string;
    chevronRight: string;
    chevronDown: string;
    layers: string;
};
/**
 * Handlebars テンプレートをコンパイル
 */
export declare function compileTemplate(template: string): Handlebars.TemplateDelegate;
/**
 * テンプレートファイルを読み込んでコンパイル
 */
export declare function loadTemplate(templatePath: string): Handlebars.TemplateDelegate;
//# sourceMappingURL=html.d.ts.map