/**
 * overview コマンド - プロジェクト概要ページ生成
 *
 * config とオプションの OVERVIEW.md から、プロジェクトのトップレベル
 * ドキュメントページを生成する
 */
import { resolve } from "node:path";
import { loadConfig, getOutputPath, resolvePath } from "../utils/config.js";
import { ensureDir, writeFile, readFile } from "../utils/file.js";
import { createLogger } from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import { wrapHtmlDocument, escapeHtml, icons } from "../utils/html.js";
/**
 * overview コマンドハンドラ
 */
export function overviewCommand(options) {
    const logger = createLogger(options.verbose);
    const projectPath = resolve(options.project);
    logger.info(t("commands.overview.generating"));
    // 設定読み込み
    const config = loadConfig(projectPath, options.config);
    const overviewConfig = config.overview;
    if (overviewConfig?.enabled === false) {
        logger.info(t("commands.overview.disabled"));
        return 0;
    }
    // 出力ディレクトリ
    const portalDir = options.output
        ? resolve(options.output)
        : getOutputPath(config, projectPath, "portal");
    ensureDir(portalDir);
    // 追加情報を収集
    const packageInfo = loadPackageJson(projectPath);
    const featureMapStats = loadFeatureMapStats(portalDir);
    const overviewMarkdown = loadOverviewMarkdown(projectPath, overviewConfig?.file);
    // HTML 生成
    const htmlPath = resolve(portalDir, "overview.html");
    const htmlContent = generateOverviewHtml(config, packageInfo, featureMapStats, overviewMarkdown);
    writeFile(htmlPath, htmlContent);
    logger.success(`Overview: ${htmlPath}`);
    logger.success(t("commands.overview.done"));
    return 0;
}
/**
 * package.json を読み込む
 */
function loadPackageJson(projectPath) {
    const packageJsonPath = resolve(projectPath, "package.json");
    const content = readFile(packageJsonPath);
    if (!content) {
        return {};
    }
    try {
        return JSON.parse(content);
    }
    catch {
        return {};
    }
}
/**
 * feature-map.json から統計を読み込む
 */
function loadFeatureMapStats(portalDir) {
    const featureMapPath = resolve(portalDir, "feature-map.json");
    const content = readFile(featureMapPath);
    if (!content) {
        return null;
    }
    try {
        const data = JSON.parse(content);
        const features = data.features || {};
        const uncategorized = data.uncategorized || {};
        let screenCount = uncategorized.screens?.length || 0;
        let componentCount = uncategorized.components?.length || 0;
        let actionCount = uncategorized.actions?.length || 0;
        let tableCount = uncategorized.tables?.length || 0;
        for (const group of Object.values(features)) {
            screenCount += group.screens?.length || 0;
            componentCount += group.components?.length || 0;
            actionCount += group.actions?.length || 0;
            tableCount += group.tables?.length || 0;
        }
        return {
            featureCount: Object.keys(features).length,
            screenCount,
            componentCount,
            actionCount,
            tableCount,
        };
    }
    catch {
        return null;
    }
}
/**
 * OVERVIEW.md を読み込む
 */
function loadOverviewMarkdown(projectPath, overviewFile) {
    if (!overviewFile) {
        return null;
    }
    const overviewPath = resolvePath(projectPath, overviewFile);
    return readFile(overviewPath);
}
/**
 * 技術スタックを package.json から自動検出
 */
function autoDetectTechStack(packageInfo) {
    const deps = { ...packageInfo.dependencies, ...packageInfo.devDependencies };
    const stack = [];
    // Frontend
    const frontend = [];
    if (deps["next"])
        frontend.push(`Next.js ${extractVersion(deps["next"])}`);
    if (deps["react"])
        frontend.push(`React ${extractVersion(deps["react"])}`);
    if (deps["typescript"])
        frontend.push(`TypeScript ${extractVersion(deps["typescript"])}`);
    if (frontend.length > 0)
        stack.push({ category: "Frontend", items: frontend });
    // Backend
    const backend = [];
    if (deps["better-auth"])
        backend.push(`Better Auth ${extractVersion(deps["better-auth"])}`);
    if (deps["drizzle-orm"])
        backend.push(`Drizzle ORM ${extractVersion(deps["drizzle-orm"])}`);
    if (deps["zod"])
        backend.push(`Zod ${extractVersion(deps["zod"])}`);
    if (backend.length > 0)
        stack.push({ category: "Backend", items: backend });
    // Database
    const database = [];
    if (deps["postgres"] || deps["pg"])
        database.push("PostgreSQL");
    if (deps["redis"] || deps["ioredis"])
        database.push("Redis");
    if (database.length > 0)
        stack.push({ category: "Database", items: database });
    // Testing
    const testing = [];
    if (deps["jest"])
        testing.push(`Jest ${extractVersion(deps["jest"])}`);
    if (deps["@playwright/test"])
        testing.push(`Playwright ${extractVersion(deps["@playwright/test"])}`);
    if (deps["vitest"])
        testing.push(`Vitest ${extractVersion(deps["vitest"])}`);
    if (testing.length > 0)
        stack.push({ category: "Testing", items: testing });
    // Styling
    const styling = [];
    if (deps["tailwindcss"])
        styling.push(`Tailwind CSS ${extractVersion(deps["tailwindcss"])}`);
    if (deps["@radix-ui/react-slot"])
        styling.push("Radix UI");
    if (styling.length > 0)
        stack.push({ category: "Styling", items: styling });
    // i18n
    const i18n = [];
    if (deps["next-intl"])
        i18n.push(`next-intl ${extractVersion(deps["next-intl"])}`);
    if (i18n.length > 0)
        stack.push({ category: "i18n", items: i18n });
    return stack;
}
/**
 * バージョン文字列を抽出
 */
function extractVersion(version) {
    if (!version)
        return "";
    return version.replace(/[\^~>=<]/g, "").split(".").slice(0, 2).join(".");
}
/**
 * Overview HTML を生成
 */
function generateOverviewHtml(config, packageInfo, stats, overviewMarkdown) {
    const projectName = config.project.name;
    const projectDesc = config.project.description || packageInfo.description || "";
    const projectVersion = config.project.version || packageInfo.version || "0.0.0";
    const projectRepo = config.project.repository || "";
    const overviewConfig = config.overview || {};
    // 技術スタック (設定優先、なければ自動検出)
    const techStack = overviewConfig.techStack && overviewConfig.techStack.length > 0
        ? overviewConfig.techStack
        : autoDetectTechStack(packageInfo);
    // HTML 生成
    const content = `
    <div class="main-container">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-title">目次</div>
        </div>
        <nav id="toc" class="toc-nav">
          <!-- JavaScriptで生成 -->
        </nav>
      </aside>
      <div class="content">
        ${generateHeader(projectName, projectVersion, projectDesc, projectRepo)}
        ${generateArchitectureSection(overviewConfig.layers || [])}
        ${generateFeaturesSection(overviewConfig.features || [])}
        ${generateTechStackSection(techStack)}
        ${generateQuickLinksSection(overviewConfig.quickLinks || [])}
        ${generateStatsSection(stats)}
        ${generateMarkdownSection(overviewMarkdown)}
        ${generateFooter(projectName)}
      </div>
    </div>
  `;
    const styles = getStyles();
    const scripts = getScripts();
    return wrapHtmlDocument({
        title: `${projectName} - プロジェクト概要`,
        content,
        styles,
        scripts,
    });
}
/**
 * ヘッダーセクション生成
 */
function generateHeader(name, version, description, repository) {
    const repoLink = repository
        ? `<a href="${escapeHtml(repository)}" class="repo-link" target="_blank">
         ${icons.external}
         GitHub
       </a>`
        : "";
    return `
    <header class="hero">
      <div class="hero-content">
        <h1>${escapeHtml(name)}</h1>
        <span class="version-badge">v${escapeHtml(version)}</span>
      </div>
      <p class="description">${escapeHtml(description)}</p>
      <div class="hero-links">
        ${repoLink}
        <a href="./index.html" class="portal-link">
          ${icons.grid}
          ドキュメントポータル
        </a>
        <a href="./feature-map.html" class="feature-link">
          ${icons.feature}
          機能マップ
        </a>
        <a href="./test-cases.html" class="test-link">
          ${icons.check}
          テストケース
        </a>
      </div>
    </header>
  `;
}
/**
 * アーキテクチャセクション生成
 */
function generateArchitectureSection(layers) {
    if (layers.length === 0) {
        return "";
    }
    const layersHtml = layers.map((layer, index) => {
        const colorClass = layer.color || "blue";
        const icon = getLayerIcon(layer.icon || "layers");
        const isLast = index === layers.length - 1;
        return `
      <div class="layer layer-${colorClass}">
        <div class="layer-icon">${icon}</div>
        <div class="layer-content">
          <div class="layer-name">${escapeHtml(layer.name)}</div>
          <div class="layer-desc">${escapeHtml(layer.description)}</div>
        </div>
      </div>
      ${!isLast ? '<div class="layer-arrow"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg></div>' : ""}
    `;
    }).join("\n");
    return `
    <section class="architecture">
      <h2 class="section-title">
        ${icons.layers}
        アーキテクチャ
      </h2>
      <div class="layers-container">
        ${layersHtml}
      </div>
    </section>
  `;
}
/**
 * 機能セクション生成
 */
function generateFeaturesSection(features) {
    if (features.length === 0) {
        return "";
    }
    const featuresHtml = features.map((feature) => {
        const statusClass = feature.status || "stable";
        const statusLabel = getStatusLabel(statusClass);
        const priorityBadge = feature.priority === "core"
            ? '<span class="priority-badge core">Core</span>'
            : "";
        return `
      <a href="./feature-map.html#feature-${escapeHtml(feature.name)}" class="feature-card">
        <div class="feature-header">
          <h3>${escapeHtml(feature.name)}</h3>
          <div class="feature-badges">
            ${priorityBadge}
            <span class="status-badge ${statusClass}">${statusLabel}</span>
          </div>
        </div>
        <p>${escapeHtml(feature.description)}</p>
      </a>
    `;
    }).join("\n");
    return `
    <section class="features">
      <h2 class="section-title">
        ${icons.feature}
        機能一覧
      </h2>
      <div class="feature-grid">
        ${featuresHtml}
      </div>
    </section>
  `;
}
/**
 * 技術スタックセクション生成
 */
function generateTechStackSection(techStack) {
    if (techStack.length === 0) {
        return "";
    }
    const stackHtml = techStack.map((stack) => {
        const itemsHtml = stack.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");
        return `
      <div class="stack-category">
        <h4>${escapeHtml(stack.category)}</h4>
        <ul>
          ${itemsHtml}
        </ul>
      </div>
    `;
    }).join("\n");
    return `
    <section class="tech-stack">
      <h2 class="section-title">
        ${icons.code}
        技術スタック
      </h2>
      <div class="stack-grid">
        ${stackHtml}
      </div>
    </section>
  `;
}
/**
 * クイックリンクセクション生成
 */
function generateQuickLinksSection(quickLinks) {
    if (quickLinks.length === 0) {
        return "";
    }
    const linksHtml = quickLinks.map((link) => `
    <div class="command-item">
      <span class="command-label">${escapeHtml(link.text)}</span>
      <code class="command-code">${escapeHtml(link.command)}</code>
      <button class="copy-btn" onclick="copyCommand('${escapeHtml(link.command)}')" title="コピー">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
    </div>
  `).join("\n");
    return `
    <section class="quick-links">
      <h2 class="section-title">
        ${icons.settings}
        クイックスタート
      </h2>
      <div class="commands-container">
        ${linksHtml}
      </div>
    </section>
  `;
}
/**
 * 統計セクション生成
 */
function generateStatsSection(stats) {
    if (!stats) {
        return "";
    }
    return `
    <section class="stats">
      <h2 class="section-title">
        ${icons.grid}
        統計
      </h2>
      <div class="stats-grid">
        <div class="stat-item stat-features">
          <span class="stat-number">${stats.featureCount}</span>
          <span class="stat-label">Features</span>
        </div>
        <div class="stat-item stat-screens">
          <span class="stat-number">${stats.screenCount}</span>
          <span class="stat-label">Screens</span>
        </div>
        <div class="stat-item stat-components">
          <span class="stat-number">${stats.componentCount}</span>
          <span class="stat-label">Components</span>
        </div>
        <div class="stat-item stat-actions">
          <span class="stat-number">${stats.actionCount}</span>
          <span class="stat-label">Actions</span>
        </div>
        <div class="stat-item stat-tables">
          <span class="stat-number">${stats.tableCount}</span>
          <span class="stat-label">Tables</span>
        </div>
      </div>
    </section>
  `;
}
/**
 * Markdown コンテンツセクション生成
 */
function generateMarkdownSection(markdown) {
    if (!markdown) {
        return "";
    }
    return `
    <section class="overview-content">
      <div id="markdownContent" class="markdown-body"></div>
    </section>
    <script type="text/plain" id="markdownSource">${escapeHtml(markdown)}</script>
  `;
}
/**
 * フッター生成
 */
function generateFooter(projectName) {
    return `
    <footer>
      <p>${escapeHtml(projectName)} &middot; Generated by shirokuma-flow</p>
    </footer>
  `;
}
/**
 * レイヤーアイコンを取得
 */
function getLayerIcon(iconName) {
    const iconMap = {
        monitor: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
        lightning: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
        database: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
        layers: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
        code: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
        server: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
        globe: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    };
    return iconMap[iconName] || iconMap.layers;
}
/**
 * ステータスラベルを取得
 */
function getStatusLabel(status) {
    const labels = {
        stable: "Stable",
        beta: "Beta",
        planned: "Planned",
    };
    return labels[status] || "Stable";
}
/**
 * スタイル
 */
function getStyles() {
    return `
    /* Layout with Sidebar */
    .main-container {
      display: flex;
      min-height: 100vh;
    }

    .sidebar {
      width: 300px;
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
      position: sticky;
      top: 0;
      background: var(--card-bg);
      z-index: 10;
    }

    .sidebar-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
    }

    .toc-nav {
      padding: 0.5rem 0;
    }

    .toc-section {
      margin-bottom: 0.25rem;
    }

    .toc-link {
      display: block;
      padding: 0.5rem 1rem;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.85rem;
      transition: all 0.15s ease;
      border-left: 2px solid transparent;
    }

    .toc-link:hover {
      background: var(--border-color);
      color: var(--text-primary);
      text-decoration: none;
    }

    .toc-link.active {
      background: var(--border-color);
      color: var(--accent-blue);
      border-left-color: var(--accent-blue);
    }

    .toc-link.level-2 {
      padding-left: 1rem;
      font-weight: 600;
    }

    .toc-link.level-3 {
      padding-left: 2rem;
      font-size: 0.8rem;
    }

    .content {
      flex: 1;
      padding: 2rem;
      max-width: 1000px;
      margin: 0 auto;
    }

    @media (max-width: 768px) {
      .main-container {
        flex-direction: column;
      }

      .sidebar {
        position: static;
        width: 100%;
        height: auto;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
      }
    }

    /* Hero Section */
    .hero {
      text-align: center;
      padding: 3rem 0;
      margin-bottom: 3rem;
      border-bottom: 1px solid var(--border-color);
    }

    .hero-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .hero h1 {
      font-size: 3rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .version-badge {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .description {
      font-size: 1.25rem;
      color: var(--text-secondary);
      max-width: 600px;
      margin: 0 auto 1.5rem;
    }

    .hero-links {
      display: flex;
      justify-content: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .hero-links a {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 500;
      transition: all 0.2s;
      text-decoration: none;
    }

    .repo-link {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
    }

    .repo-link:hover {
      background: var(--border-color);
      text-decoration: none;
    }

    .portal-link {
      background: rgba(59, 130, 246, 0.2);
      color: var(--accent-blue);
    }

    .portal-link:hover {
      background: rgba(59, 130, 246, 0.3);
      text-decoration: none;
    }

    .feature-link {
      background: rgba(168, 85, 247, 0.2);
      color: var(--accent-purple);
    }

    .feature-link:hover {
      background: rgba(168, 85, 247, 0.3);
      text-decoration: none;
    }

    .test-link {
      background: rgba(34, 197, 94, 0.2);
      color: var(--accent-green);
    }

    .test-link:hover {
      background: rgba(34, 197, 94, 0.3);
      text-decoration: none;
    }

    /* Section Title */
    .section-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      color: var(--text-primary);
    }

    .section-title svg {
      color: var(--accent-blue);
    }

    /* Architecture Section */
    .architecture {
      margin-bottom: 3rem;
    }

    .layers-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 2rem;
    }

    .layer {
      display: flex;
      align-items: center;
      gap: 1rem;
      width: 100%;
      max-width: 500px;
      padding: 1.25rem 1.5rem;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      background: var(--bg-color);
    }

    .layer-blue {
      border-left: 4px solid var(--accent-blue);
    }

    .layer-orange {
      border-left: 4px solid var(--accent-orange);
    }

    .layer-pink {
      border-left: 4px solid var(--accent-pink);
    }

    .layer-green {
      border-left: 4px solid var(--accent-green);
    }

    .layer-purple {
      border-left: 4px solid var(--accent-purple);
    }

    .layer-icon {
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.05);
    }

    .layer-blue .layer-icon { color: var(--accent-blue); }
    .layer-orange .layer-icon { color: var(--accent-orange); }
    .layer-pink .layer-icon { color: var(--accent-pink); }
    .layer-green .layer-icon { color: var(--accent-green); }
    .layer-purple .layer-icon { color: var(--accent-purple); }

    .layer-content {
      flex: 1;
    }

    .layer-name {
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 0.25rem;
    }

    .layer-desc {
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .layer-arrow {
      color: var(--text-secondary);
      padding: 0.25rem 0;
    }

    /* Features Section */
    .features {
      margin-bottom: 3rem;
    }

    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .feature-card {
      display: block;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.25rem;
      text-decoration: none;
      transition: all 0.2s;
    }

    .feature-card:hover {
      border-color: var(--accent-blue);
      transform: translateY(-2px);
      text-decoration: none;
    }

    .feature-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.5rem;
    }

    .feature-card h3 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .feature-card p {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin: 0;
    }

    .feature-badges {
      display: flex;
      gap: 0.5rem;
    }

    .status-badge {
      font-size: 0.7rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-badge.stable {
      background: rgba(34, 197, 94, 0.2);
      color: var(--accent-green);
    }

    .status-badge.beta {
      background: rgba(249, 115, 22, 0.2);
      color: var(--accent-orange);
    }

    .status-badge.planned {
      background: rgba(113, 113, 122, 0.2);
      color: var(--text-secondary);
    }

    .priority-badge {
      font-size: 0.7rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .priority-badge.core {
      background: rgba(168, 85, 247, 0.2);
      color: var(--accent-purple);
    }

    /* Tech Stack Section */
    .tech-stack {
      margin-bottom: 3rem;
    }

    .stack-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 1.5rem;
    }

    .stack-category h4 {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }

    .stack-category ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .stack-category li {
      padding: 0.375rem 0;
      font-size: 0.9rem;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-color);
    }

    .stack-category li:last-child {
      border-bottom: none;
    }

    /* Quick Links Section */
    .quick-links {
      margin-bottom: 3rem;
    }

    .commands-container {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 1rem;
    }

    .command-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border-radius: 8px;
      transition: background 0.2s;
    }

    .command-item:hover {
      background: var(--bg-color);
    }

    .command-label {
      min-width: 150px;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .command-code {
      flex: 1;
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 0.9rem;
      background: var(--code-bg);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      color: var(--accent-green);
    }

    .copy-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      cursor: pointer;
      color: var(--text-secondary);
      transition: all 0.2s;
    }

    .copy-btn:hover {
      background: var(--border-color);
      color: var(--text-primary);
    }

    .copy-btn.copied {
      background: rgba(34, 197, 94, 0.2);
      color: var(--accent-green);
      border-color: var(--accent-green);
    }

    /* Stats Section */
    .stats {
      margin-bottom: 3rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 1rem;
    }

    .stat-item {
      text-align: center;
      padding: 1.5rem;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
    }

    .stat-number {
      display: block;
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
    }

    .stat-label {
      font-size: 0.8rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stat-features .stat-number { color: var(--accent-purple); }
    .stat-screens .stat-number { color: var(--accent-blue); }
    .stat-components .stat-number { color: var(--accent-green); }
    .stat-actions .stat-number { color: var(--accent-orange); }
    .stat-tables .stat-number { color: var(--accent-pink); }

    /* Overview Content Section */
    .overview-content {
      margin-bottom: 3rem;
    }

    .markdown-body {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 2rem;
    }

    .markdown-body h1,
    .markdown-body h2,
    .markdown-body h3,
    .markdown-body h4 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
    }

    .markdown-body h1 { font-size: 1.75em; }
    .markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    .markdown-body h3 { font-size: 1.25em; }

    .markdown-body p { margin-bottom: 1em; }

    .markdown-body ul,
    .markdown-body ol {
      margin-bottom: 1em;
      padding-left: 2em;
    }

    .markdown-body code {
      background: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 0.9em;
    }

    .markdown-body pre {
      background: var(--code-bg);
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
      margin-bottom: 1em;
    }

    .markdown-body pre code {
      background: none;
      padding: 0;
    }

    .markdown-body table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1em;
    }

    .markdown-body th,
    .markdown-body td {
      border: 1px solid var(--border-color);
      padding: 0.5rem 1rem;
      text-align: left;
    }

    .markdown-body th {
      background: var(--bg-color);
      font-weight: 600;
    }

    /* Mermaid Diagrams */
    .mermaid {
      background: transparent !important;
      text-align: center;
      margin: 1.5rem 0;
    }

    /* Footer */
    footer {
      text-align: center;
      padding: 2rem 0;
      border-top: 1px solid var(--border-color);
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .hero h1 {
        font-size: 2rem;
      }

      .hero-links {
        flex-direction: column;
        align-items: center;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .command-item {
        flex-direction: column;
        align-items: flex-start;
      }

      .command-label {
        min-width: auto;
      }

      .command-code {
        width: 100%;
      }
    }
  `;
}
/**
 * スクリプト
 */
function getScripts() {
    return `
    // コマンドをクリップボードにコピー
    function copyCommand(command) {
      navigator.clipboard.writeText(command).then(() => {
        const btns = document.querySelectorAll('.copy-btn');
        btns.forEach(btn => {
          if (btn.onclick && btn.onclick.toString().includes(command)) {
            btn.classList.add('copied');
            setTimeout(() => btn.classList.remove('copied'), 1500);
          }
        });
        // イベントからボタンを見つける方法
        event.target.closest('.copy-btn')?.classList.add('copied');
        setTimeout(() => {
          event.target.closest('.copy-btn')?.classList.remove('copied');
        }, 1500);
      });
    }

    // Markdown をレンダリング
    const markdownSource = document.getElementById('markdownSource');
    const markdownContent = document.getElementById('markdownContent');

    if (markdownSource && markdownContent) {
      // marked.js を動的ロード
      const markedScript = document.createElement('script');
      markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
      markedScript.onload = function() {
        // mermaid を動的ロード (latest)
        const mermaidScript = document.createElement('script');
        mermaidScript.src = 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js';
        mermaidScript.onload = function() {
          // Mermaid 初期化
          mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            themeVariables: {
              primaryColor: '#3b82f6',
              primaryTextColor: '#fafafa',
              primaryBorderColor: '#3b82f6',
              lineColor: '#a1a1aa',
              secondaryColor: '#1e1e1e',
              tertiaryColor: '#262626',
              background: '#141414',
              mainBkg: '#141414',
              nodeBorder: '#3b82f6',
              clusterBkg: '#1e1e1e',
              clusterBorder: '#262626',
              titleColor: '#fafafa',
              edgeLabelBackground: '#141414',
            }
          });

          // marked でレンダリング
          const rawMarkdown = markdownSource.textContent;
          const html = marked.parse(rawMarkdown);
          markdownContent.innerHTML = html;

          // HTML エンティティをデコードする関数
          function decodeHTML(html) {
            const txt = document.createElement('textarea');
            txt.innerHTML = html;
            return txt.value;
          }

          // Mermaid コードブロックを処理
          const codeBlocks = markdownContent.querySelectorAll('pre code.language-mermaid');
          console.log('Found', codeBlocks.length, 'Mermaid diagrams');
          codeBlocks.forEach((block, index) => {
            const pre = block.parentElement;
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.id = 'mermaid-' + index;
            // textContent で HTML タグを除去してから、decodeHTML で HTML エンティティをデコード
            const code = decodeHTML(block.textContent);
            mermaidDiv.textContent = code;
            console.log('Diagram #' + index + ' (first 50 chars):', code.substring(0, 50));
            pre.replaceWith(mermaidDiv);
          });

          // Mermaid をレンダリング (with error handling)
          mermaid.run().catch(error => {
            console.error('Mermaid render error:', error);
            const mermaidElements = document.querySelectorAll('.mermaid');
            mermaidElements.forEach((el, idx) => {
              console.error('Diagram #' + idx + ':', el.textContent.substring(0, 100));
            });
          });

          // 目次を生成
          generateTableOfContents();
        };
        document.head.appendChild(mermaidScript);
      };
      document.head.appendChild(markedScript);
    }

    // 目次生成関数
    function generateTableOfContents() {
      const toc = document.getElementById('toc');
      const content = document.querySelector('.content');

      if (!toc || !content) return;

      const headings = content.querySelectorAll('h2, h3');
      const tocHtml = [];

      headings.forEach((heading, index) => {
        const level = heading.tagName === 'H2' ? 2 : 3;
        const text = heading.textContent || '';
        const id = 'heading-' + index;

        // 見出しにIDを付与
        heading.id = id;

        // 目次リンクを生成
        tocHtml.push(
          '<div class="toc-section">' +
          '<a href="#' + id + '" class="toc-link level-' + level + '" data-target="' + id + '">' +
          text +
          '</a>' +
          '</div>'
        );
      });

      toc.innerHTML = tocHtml.join('');

      // スムーズスクロール
      const tocLinks = toc.querySelectorAll('.toc-link');
      tocLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const targetId = link.getAttribute('data-target');
          const target = document.getElementById(targetId);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });

      // スクロール時に現在位置をハイライト
      const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const id = entry.target.id;
          const tocLink = toc.querySelector('[data-target="' + id + '"]');

          if (entry.isIntersecting && tocLink) {
            // 全てのactiveクラスを削除
            toc.querySelectorAll('.toc-link').forEach(link => {
              link.classList.remove('active');
            });
            // 現在の見出しに対応するリンクをアクティブに
            tocLink.classList.add('active');
          }
        });
      }, observerOptions);

      // 全ての見出しを監視
      headings.forEach(heading => {
        observer.observe(heading);
      });
    }

    // ページロード時に目次を生成（Markdownがない場合でも）
    if (!document.getElementById('markdownSource')) {
      generateTableOfContents();
    }
  `;
}
//# sourceMappingURL=overview.js.map