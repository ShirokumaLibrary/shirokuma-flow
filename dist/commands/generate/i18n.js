/**
 * i18n コマンド - 翻訳ファイルドキュメント生成
 *
 * @description
 * Next.js/next-intl のメッセージファイル (messages/{locale}/*.json) をスキャンし、
 * 翻訳キーのドキュメントを生成する。
 *
 * 機能:
 * - 各 namespace (ファイル名) ごとの翻訳キー一覧
 * - 言語間の翻訳比較テーブル
 * - 不足キーの検出
 * - 翻訳カバレッジ統計
 */
import { resolve, relative } from "node:path";
import { globSync } from "glob";
import { loadConfig, getOutputPath } from "../../utils/config.js";
import { ensureDir, writeFile, readFile } from "../../utils/file.js";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
import { wrapHtmlDocument, escapeHtml, icons } from "../../utils/html.js";
/**
 * デフォルト設定を取得
 */
function getDefaultI18nConfig() {
    return {
        enabled: true,
        include: ["apps/*/messages/**/*.json"],
        exclude: [],
        primaryLocale: "ja",
    };
}
/**
 * 設定を解決
 */
function resolveI18nConfig(config) {
    const defaults = getDefaultI18nConfig();
    return {
        enabled: config?.enabled ?? defaults.enabled,
        include: config?.include ?? defaults.include,
        exclude: config?.exclude ?? defaults.exclude,
        primaryLocale: config?.primaryLocale ?? defaults.primaryLocale,
    };
}
/**
 * i18n コマンドハンドラ
 */
export function i18nCommand(options) {
    const logger = createLogger(options.verbose);
    const projectPath = resolve(options.project);
    logger.info(t("commands.i18nCmd.generating"));
    // 設定読み込み
    const config = loadConfig(projectPath, options.config);
    // i18n設定は未定義の可能性があるため、安全にアクセス
    const configWithI18n = config;
    const i18nConfig = resolveI18nConfig(configWithI18n.i18n);
    // メッセージファイルを収集
    const files = collectMessageFiles(projectPath, i18nConfig);
    logger.debug(`対象ファイル数: ${files.length}`);
    if (files.length === 0) {
        logger.warn(t("commands.i18nCmd.noMessageFiles"));
        return 0;
    }
    // ファイルをパース
    const { locales, apps, namespaceData } = parseMessageFiles(projectPath, files, logger);
    logger.info(`検出された言語: ${locales.join(", ")}`);
    if (apps.length > 0) {
        logger.info(`検出されたアプリ: ${apps.join(", ")}`);
    }
    logger.info(`検出された namespace: ${namespaceData.size}`);
    // ドキュメントを構築
    const documentation = buildI18nDocumentation(locales, apps, namespaceData, i18nConfig.primaryLocale);
    // 出力先
    const portalDir = options.output
        ? resolve(options.output)
        : getOutputPath(config, projectPath, "portal");
    ensureDir(portalDir);
    // JSON 出力
    const jsonPath = resolve(portalDir, "i18n.json");
    writeFile(jsonPath, JSON.stringify(documentation, null, 2));
    logger.success(`JSON: ${jsonPath}`);
    // HTML 一覧ページ出力
    const htmlPath = resolve(portalDir, "i18n.html");
    const htmlContent = generateI18nListHtml(documentation, config.project.name);
    writeFile(htmlPath, htmlContent);
    logger.success(`HTML: ${htmlPath}`);
    // 各 namespace の詳細ページ出力
    const i18nDir = resolve(portalDir, "i18n");
    ensureDir(i18nDir);
    for (const namespace of documentation.namespaces) {
        const namespaceHtmlPath = resolve(i18nDir, `${namespace.name}.html`);
        const namespaceHtmlContent = generateNamespaceDetailHtml(namespace, documentation.locales, config.project.name);
        writeFile(namespaceHtmlPath, namespaceHtmlContent);
    }
    logger.success(`詳細ページ: ${documentation.namespaces.length} files in ${i18nDir}`);
    logger.success(t("commands.i18nCmd.done"));
    return 0;
}
/**
 * メッセージファイルを収集
 */
function collectMessageFiles(projectPath, config) {
    const allFiles = new Set();
    for (const pattern of config.include) {
        const files = globSync(pattern, {
            cwd: projectPath,
            absolute: true,
            ignore: config.exclude,
        });
        for (const file of files) {
            allFiles.add(file);
        }
    }
    return Array.from(allFiles).sort();
}
/**
 * ファイルパスから app, locale, namespace を抽出
 *
 * @example
 * "apps/admin/messages/ja/auth.json" → { app: "admin", locale: "ja", namespace: "auth" }
 * "apps/web/messages/ja/auth.json" → { app: "web", locale: "ja", namespace: "auth" }
 */
function parseFilePath(filePath) {
    // パターン: apps/{app}/messages/{locale}/{namespace}.json
    const appMatch = filePath.match(/apps\/([^/]+)\/messages\/([^/]+)\/([^/]+)\.json$/);
    if (appMatch) {
        return {
            app: appMatch[1],
            locale: appMatch[2],
            namespace: appMatch[3],
        };
    }
    // フォールバック: .../messages/{locale}/{namespace}.json (app なし)
    const match = filePath.match(/messages\/([^/]+)\/([^/]+)\.json$/);
    if (match) {
        return {
            app: null,
            locale: match[1],
            namespace: match[2],
        };
    }
    return null;
}
/**
 * メッセージファイルをパース
 */
function parseMessageFiles(projectPath, files, logger) {
    const localesSet = new Set();
    const appsSet = new Set();
    // key -> { app, namespace, localeData: locale -> data }
    const namespaceData = new Map();
    for (const file of files) {
        const parsed = parseFilePath(file);
        if (!parsed) {
            logger.warn(`パス解析失敗: ${relative(projectPath, file)}`);
            continue;
        }
        const { app, locale, namespace } = parsed;
        localesSet.add(locale);
        if (app)
            appsSet.add(app);
        // 一意キー: app がある場合は "app/namespace"、ない場合は "namespace"
        const key = app ? `${app}/${namespace}` : namespace;
        // JSON を読み込み
        const content = readFile(file);
        if (!content)
            continue;
        try {
            const data = JSON.parse(content);
            if (!namespaceData.has(key)) {
                namespaceData.set(key, { app, namespace, localeData: new Map() });
            }
            namespaceData.get(key).localeData.set(locale, data);
        }
        catch {
            logger.warn(`JSON パース失敗: ${relative(projectPath, file)}`);
        }
    }
    // locale をソート (primaryLocale を先頭に)
    const locales = Array.from(localesSet).sort();
    const apps = Array.from(appsSet).sort();
    return { locales, apps, namespaceData };
}
/**
 * JSON オブジェクトからキーをフラット化して抽出
 *
 * @example
 * { "form": { "title": "..." } } → ["form.title"]
 */
function flattenKeys(obj, prefix = "") {
    const keys = [];
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === "object" && !Array.isArray(value)) {
            keys.push(...flattenKeys(value, fullKey));
        }
        else {
            keys.push(fullKey);
        }
    }
    return keys;
}
/**
 * ネストされたオブジェクトから値を取得
 *
 * @example
 * getValue({ form: { title: "Hello" } }, "form.title") → "Hello"
 */
function getValue(obj, path) {
    const parts = path.split(".");
    let current = obj;
    for (const part of parts) {
        if (current && typeof current === "object" && part in current) {
            current = current[part];
        }
        else {
            return undefined;
        }
    }
    if (typeof current === "string") {
        return current;
    }
    if (typeof current === "number" || typeof current === "boolean") {
        return String(current);
    }
    return undefined;
}
/**
 * アプリ名からメタ情報を生成
 */
function getAppMeta(appId) {
    const appMeta = {
        admin: { name: "Admin", icon: "settings", color: "blue" },
        public: { name: "Public", icon: "globe", color: "green" },
        web: { name: "WEB", icon: "monitor", color: "blue" },
        mcp: { name: "MCP", icon: "bot", color: "purple" },
    };
    return appMeta[appId] || { name: appId.charAt(0).toUpperCase() + appId.slice(1), icon: "folder", color: "gray" };
}
/**
 * i18n ドキュメントを構築
 */
function buildI18nDocumentation(locales, apps, namespaceData, primaryLocale) {
    // primaryLocale を先頭に
    const sortedLocales = [
        primaryLocale,
        ...locales.filter((l) => l !== primaryLocale),
    ].filter((l) => locales.includes(l));
    const namespaces = [];
    let totalKeys = 0;
    let totalFullyTranslated = 0;
    for (const [key, { app, localeData }] of namespaceData) {
        // 全キーを収集
        const allKeys = new Set();
        for (const data of localeData.values()) {
            for (const k of flattenKeys(data)) {
                allKeys.add(k);
            }
        }
        const entries = [];
        const keysByLocale = {};
        let fullyTranslatedKeys = 0;
        for (const locale of sortedLocales) {
            keysByLocale[locale] = 0;
        }
        // キーをソートして処理
        for (const k of Array.from(allKeys).sort()) {
            const values = {};
            let hasAllTranslations = true;
            for (const locale of sortedLocales) {
                const data = localeData.get(locale);
                const value = data ? getValue(data, k) : undefined;
                values[locale] = value;
                if (value !== undefined) {
                    keysByLocale[locale]++;
                }
                else {
                    hasAllTranslations = false;
                }
            }
            entries.push({ key: k, values });
            if (hasAllTranslations) {
                fullyTranslatedKeys++;
            }
        }
        const totalKeysInNamespace = allKeys.size;
        const missingKeys = totalKeysInNamespace - fullyTranslatedKeys;
        // 説明を推論 (title キーがあればその値を使用)
        const primaryData = localeData.get(primaryLocale);
        let description;
        if (primaryData) {
            description = getValue(primaryData, "title") || getValue(primaryData, "description");
        }
        namespaces.push({
            name: key, // app/namespace 形式またはただの namespace
            app: app || undefined,
            description,
            entries,
            stats: {
                totalKeys: totalKeysInNamespace,
                keysByLocale,
                fullyTranslatedKeys,
                missingKeys,
            },
        });
        totalKeys += totalKeysInNamespace;
        totalFullyTranslated += fullyTranslatedKeys;
    }
    // namespace 名でソート (app/namespace 形式でソートされる)
    namespaces.sort((a, b) => a.name.localeCompare(b.name));
    const coveragePercent = totalKeys > 0 ? Math.round((totalFullyTranslated / totalKeys) * 100) : 100;
    // アプリ情報を集計
    const appStats = new Map();
    for (const ns of namespaces) {
        const appId = ns.app || "default";
        if (!appStats.has(appId)) {
            appStats.set(appId, { namespaceCount: 0, keyCount: 0 });
        }
        const stats = appStats.get(appId);
        stats.namespaceCount++;
        stats.keyCount += ns.stats.totalKeys;
    }
    // アプリリストを生成
    const i18nApps = apps.map((appId) => {
        const stats = appStats.get(appId) || { namespaceCount: 0, keyCount: 0 };
        const meta = getAppMeta(appId);
        return {
            id: appId,
            name: meta.name,
            icon: meta.icon,
            color: meta.color,
            namespaceCount: stats.namespaceCount,
            keyCount: stats.keyCount,
        };
    });
    return {
        locales: sortedLocales,
        primaryLocale,
        apps: i18nApps,
        namespaces,
        stats: {
            totalNamespaces: namespaces.length,
            totalKeys,
            coveragePercent,
        },
        generatedAt: new Date().toISOString(),
    };
}
/**
 * i18n 一覧ページ HTML を生成
 */
function generateI18nListHtml(doc, projectName) {
    const styles = getListStyles();
    const namespaceRows = doc.namespaces
        .map((ns) => {
        const coverage = ns.stats.totalKeys > 0
            ? Math.round((ns.stats.fullyTranslatedKeys / ns.stats.totalKeys) * 100)
            : 100;
        const coverageClass = coverage === 100 ? "complete" : coverage >= 80 ? "good" : "warning";
        return `
        <tr>
          <td>
            <a href="i18n/${escapeHtml(ns.name)}.html" class="namespace-link">
              ${escapeHtml(ns.name)}
            </a>
          </td>
          <td class="description">${ns.description ? escapeHtml(ns.description) : "-"}</td>
          <td class="number">${ns.stats.totalKeys}</td>
          <td class="number ${coverageClass}">${coverage}%</td>
          <td class="number ${ns.stats.missingKeys > 0 ? "warning" : ""}">${ns.stats.missingKeys}</td>
        </tr>
      `;
    })
        .join("");
    const content = `
    <div class="container">
      <div class="page-header">
        <h1 class="page-title">${escapeHtml(projectName)} 翻訳ドキュメント</h1>
        <p class="page-description">
          next-intl メッセージファイルから抽出された翻訳キー一覧
          <a href="i18n.json" class="export-link" download title="JSONエクスポート">
            ${icons.download} JSON
          </a>
        </p>
      </div>

      <div class="summary-card">
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-value">${doc.stats.totalNamespaces}</div>
            <div class="summary-label">Namespaces</div>
          </div>
          <div class="summary-item">
            <div class="summary-value">${doc.stats.totalKeys}</div>
            <div class="summary-label">Total Keys</div>
          </div>
          <div class="summary-item">
            <div class="summary-value">${doc.locales.length}</div>
            <div class="summary-label">Languages</div>
          </div>
          <div class="summary-item coverage">
            <div class="summary-value">${doc.stats.coveragePercent}%</div>
            <div class="summary-label">Coverage</div>
          </div>
        </div>
        <div class="locale-badges">
          ${doc.locales.map((l) => `<span class="locale-badge ${l === doc.primaryLocale ? "primary" : ""}">${escapeHtml(l)}</span>`).join("")}
        </div>
        <div class="summary-meta">
          生成日時: ${new Date(doc.generatedAt).toLocaleString("ja-JP")}
        </div>
      </div>

      <table class="namespace-table">
        <thead>
          <tr>
            <th>Namespace</th>
            <th>Description</th>
            <th class="number">Keys</th>
            <th class="number">Coverage</th>
            <th class="number">Missing</th>
          </tr>
        </thead>
        <tbody>
          ${namespaceRows}
        </tbody>
      </table>
    </div>
  `;
    return wrapHtmlDocument({
        title: `i18n - ${projectName}`,
        content,
        styles,
        headElements: `<link rel="stylesheet" href="/global-nav.css">`,
        bodyEndScripts: `<script src="/global-nav.js"></script>`,
    });
}
/**
 * Namespace 詳細ページ HTML を生成
 */
function generateNamespaceDetailHtml(namespace, locales, projectName) {
    const styles = getDetailStyles();
    const headerCells = locales.map((l) => `<th class="locale-header">${escapeHtml(l)}</th>`).join("");
    const rows = namespace.entries
        .map((entry) => {
        const valueCells = locales
            .map((l) => {
            const value = entry.values[l];
            if (value === undefined) {
                return `<td class="missing">-</td>`;
            }
            // 長い値は truncate
            const displayValue = value.length > 80 ? value.substring(0, 80) + "..." : value;
            return `<td title="${escapeHtml(value)}">${escapeHtml(displayValue)}</td>`;
        })
            .join("");
        const hasMissing = locales.some((l) => entry.values[l] === undefined);
        return `
        <tr class="${hasMissing ? "has-missing" : ""}">
          <td class="key-cell">
            <code>${escapeHtml(entry.key)}</code>
          </td>
          ${valueCells}
        </tr>
      `;
    })
        .join("");
    const coverage = namespace.stats.totalKeys > 0
        ? Math.round((namespace.stats.fullyTranslatedKeys / namespace.stats.totalKeys) * 100)
        : 100;
    const content = `
    <div class="container">
      <nav class="breadcrumb">
        <a href="../i18n.html">i18n</a>
        <span>/</span>
        <span>${escapeHtml(namespace.name)}</span>
      </nav>

      <div class="page-header">
        <h1 class="page-title">${escapeHtml(namespace.name)}</h1>
        ${namespace.description ? `<p class="page-description">${escapeHtml(namespace.description)}</p>` : ""}
      </div>

      <div class="stats-bar">
        <div class="stat">
          <span class="stat-label">Keys:</span>
          <span class="stat-value">${namespace.stats.totalKeys}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Coverage:</span>
          <span class="stat-value ${coverage === 100 ? "complete" : ""}">${coverage}%</span>
        </div>
        <div class="stat">
          <span class="stat-label">Missing:</span>
          <span class="stat-value ${namespace.stats.missingKeys > 0 ? "warning" : ""}">${namespace.stats.missingKeys}</span>
        </div>
      </div>

      <table class="translation-table">
        <thead>
          <tr>
            <th class="key-header">Key</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
    return wrapHtmlDocument({
        title: `${namespace.name} - i18n - ${projectName}`,
        content,
        styles,
        headElements: `<link rel="stylesheet" href="/global-nav.css">`,
        bodyEndScripts: `<script src="/global-nav.js"></script>`,
    });
}
/**
 * 一覧ページスタイル
 */
function getListStyles() {
    return `
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    .export-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      margin-left: 1rem;
      padding: 0.25rem 0.5rem;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      font-size: 0.75rem;
      color: var(--text-secondary);
      text-decoration: none;
      transition: all 0.2s;
    }

    .export-link:hover {
      background: var(--border-color);
      color: var(--text-primary);
      text-decoration: none;
    }

    .export-link svg {
      width: 12px;
      height: 12px;
    }

    .summary-card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .summary-item {
      text-align: center;
      padding: 0.75rem;
      background: var(--bg-color);
      border-radius: 8px;
    }

    .summary-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .summary-item.coverage .summary-value {
      color: #22c55e;
    }

    .summary-label {
      font-size: 0.7rem;
      color: var(--text-secondary);
      margin-top: 0.125rem;
    }

    .locale-badges {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
    }

    .locale-badge {
      padding: 0.25rem 0.5rem;
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .locale-badge.primary {
      background: rgba(59, 130, 246, 0.15);
      border-color: rgba(59, 130, 246, 0.3);
      color: #3b82f6;
    }

    .summary-meta {
      text-align: right;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .namespace-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }

    .namespace-table th,
    .namespace-table td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }

    .namespace-table th {
      background: var(--bg-color);
      font-weight: 600;
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .namespace-table th.number,
    .namespace-table td.number {
      text-align: right;
      width: 80px;
    }

    .namespace-table td.description {
      color: var(--text-secondary);
      font-size: 0.85rem;
    }

    .namespace-table tr:last-child td {
      border-bottom: none;
    }

    .namespace-table tr:hover {
      background: rgba(59, 130, 246, 0.05);
    }

    .namespace-link {
      font-weight: 500;
      color: var(--accent-blue);
      text-decoration: none;
      font-family: monospace;
    }

    .namespace-link:hover {
      text-decoration: underline;
    }

    .complete { color: #22c55e; }
    .good { color: #eab308; }
    .warning { color: #ef4444; }

    @media (max-width: 768px) {
      .summary-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .namespace-table td.description {
        display: none;
      }
    }
  `;
}
/**
 * 詳細ページスタイル
 */
function getDetailStyles() {
    return `
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .breadcrumb a {
      color: var(--accent-blue);
      text-decoration: none;
    }

    .breadcrumb a:hover {
      text-decoration: underline;
    }

    .stats-bar {
      display: flex;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
      padding: 0.75rem 1rem;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .stat-label {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .stat-value {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--text-primary);
    }

    .stat-value.complete { color: #22c55e; }
    .stat-value.warning { color: #ef4444; }

    .translation-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
      font-size: 0.85rem;
    }

    .translation-table th,
    .translation-table td {
      padding: 0.625rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
      vertical-align: top;
    }

    .translation-table th {
      background: var(--bg-color);
      font-weight: 600;
      font-size: 0.8rem;
      color: var(--text-secondary);
      position: sticky;
      top: 0;
    }

    .translation-table tr:last-child td {
      border-bottom: none;
    }

    .translation-table tr:hover {
      background: rgba(59, 130, 246, 0.05);
    }

    .translation-table tr.has-missing {
      background: rgba(239, 68, 68, 0.05);
    }

    .key-header {
      width: 250px;
      min-width: 200px;
    }

    .locale-header {
      min-width: 200px;
    }

    .key-cell {
      font-family: monospace;
      font-size: 0.8rem;
      color: var(--accent-blue);
    }

    .key-cell code {
      background: transparent;
      padding: 0;
    }

    .translation-table td.missing {
      color: var(--text-secondary);
      font-style: italic;
      background: rgba(239, 68, 68, 0.1);
    }

    @media (max-width: 768px) {
      .stats-bar {
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .translation-table {
        font-size: 0.75rem;
      }

      .key-header,
      .locale-header {
        min-width: 120px;
      }
    }
  `;
}
//# sourceMappingURL=i18n.js.map