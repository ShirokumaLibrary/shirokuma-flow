/**
 * link-docs コマンド - API-テスト関連付け機能
 *
 * lint-coverage のデータを活用し、実装ファイルとテストファイルを
 * 双方向にリンクする統合ビューを生成する
 */
import { resolve, relative, basename, dirname, join } from "node:path";
import { globSync } from "glob";
import { loadConfig, getOutputPath } from "../../utils/config.js";
import { ensureDir, writeFile, readFile } from "../../utils/file.js";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
import { safeRegExp } from "../../utils/sanitize.js";
import { wrapHtmlDocument, escapeHtml, icons } from "../../utils/html.js";
import { defaultConventions, defaultExcludes, } from "../../lint/coverage-types.js";
import { collectJestFiles, collectPlaywrightFiles, } from "./test-cases.js";
import { extractTestCases } from "../../parsers/test-annotations.js";
/**
 * link-docs コマンドハンドラ
 */
export async function linkDocsCommand(options) {
    const logger = createLogger(options.verbose);
    const projectPath = resolve(options.project);
    logger.info(t("commands.linkDocs.generating"));
    // 設定読み込み
    const config = loadConfig(projectPath, options.config);
    const coverageConfig = config.lintCoverage || {};
    const testConfig = config.testCases;
    // 規約マッピングを取得
    const conventions = coverageConfig.conventions || defaultConventions;
    const excludes = coverageConfig.exclude || defaultExcludes;
    logger.debug(`規約数: ${conventions.length}`);
    // ソースファイルを収集
    const sourceFiles = collectSourceFiles(projectPath, conventions, excludes);
    logger.debug(`ソースファイル数: ${sourceFiles.length}`);
    // テストファイルとテストケースを収集
    const jestFiles = await collectJestFiles(projectPath, testConfig?.jest);
    const playwrightFiles = await collectPlaywrightFiles(projectPath, testConfig?.playwright);
    logger.debug(`Jest テストファイル数: ${jestFiles.length}`);
    logger.debug(`Playwright テストファイル数: ${playwrightFiles.length}`);
    // テストケースを抽出
    const allTestCases = [];
    const testFileToTestCases = new Map();
    for (const file of jestFiles) {
        const content = readFile(file);
        if (!content)
            continue;
        const relativePath = relative(projectPath, file);
        const cases = extractTestCases(content, relativePath, "jest");
        allTestCases.push(...cases);
        testFileToTestCases.set(relativePath, cases);
    }
    for (const file of playwrightFiles) {
        const content = readFile(file);
        if (!content)
            continue;
        const relativePath = relative(projectPath, file);
        const cases = extractTestCases(content, relativePath, "playwright");
        allTestCases.push(...cases);
        testFileToTestCases.set(relativePath, cases);
    }
    logger.debug(`総テストケース数: ${allTestCases.length}`);
    // リンク関係を構築
    const report = buildLinkedReport(projectPath, sourceFiles, testFileToTestCases, conventions, coverageConfig.requireSkipReason ?? true);
    logger.debug(`カバレッジ: ${report.summary.coveragePercent}%`);
    // 出力先
    const portalDir = options.output
        ? resolve(options.output)
        : getOutputPath(config, projectPath, "portal");
    ensureDir(portalDir);
    // HTML 出力
    const htmlPath = resolve(portalDir, "linked-docs.html");
    const htmlContent = generateLinkedDocsHtml(report, config.project.name);
    writeFile(htmlPath, htmlContent);
    logger.success(`統合ビュー HTML: ${htmlPath}`);
    // JSON 出力 (オプション)
    const jsonPath = resolve(portalDir, "linked-docs.json");
    writeFile(jsonPath, JSON.stringify(report, null, 2));
    logger.success(`JSON データ: ${jsonPath}`);
    logger.success(t("commands.linkDocs.done"));
    return 0;
}
/**
 * ソースファイルを収集
 */
function collectSourceFiles(projectPath, conventions, excludes) {
    const allFiles = new Set();
    for (const conv of conventions) {
        const pattern = join(projectPath, "**", conv.source);
        const files = globSync(pattern, {
            ignore: excludes.map((e) => join(projectPath, "**", e)),
            nodir: true,
        });
        for (const file of files) {
            allFiles.add(relative(projectPath, file));
        }
    }
    return Array.from(allFiles).sort();
}
/**
 * @skip-test アノテーションを抽出
 */
function extractSkipTest(content) {
    const skipTestMatch = content.match(/@skip-test\s+(.+?)(?:\n|\*\/)/);
    if (!skipTestMatch)
        return undefined;
    const reason = skipTestMatch[1].trim();
    const seeMatch = content.match(/@see\s+(\S+)/);
    const seeReference = seeMatch ? seeMatch[1] : undefined;
    return { reason, seeReference };
}
/**
 * ソースパスから期待されるテストパスを生成
 */
function getExpectedTestPath(sourcePath, conventions) {
    for (const conv of conventions) {
        const sourcePattern = conv.source.replace(/\*\*/g, "(.*)").replace(/\*/g, "([^/]*)");
        const sourceRegex = safeRegExp(`^${sourcePattern}$`);
        if (!sourceRegex)
            continue;
        const match = sourcePath.match(sourceRegex);
        if (match) {
            let testPath = conv.test;
            let index = 1;
            testPath = testPath.replace(/\*\*/g, () => match[index++] || "");
            testPath = testPath.replace(/\*/g, () => match[index++] || "");
            const dir = dirname(testPath);
            const name = basename(sourcePath, ".ts").replace(".tsx", "");
            return join(dir, `${name}.test.ts`);
        }
    }
    return undefined;
}
/**
 * リンク付きレポートを構築
 */
function buildLinkedReport(projectPath, sourceFiles, testFileToTestCases, conventions, _requireSkipReason) {
    const linkedSources = [];
    const matchedTestFiles = new Set();
    const orphanTests = [];
    // 各ソースファイルを処理
    for (const sourcePath of sourceFiles) {
        const fullPath = join(projectPath, sourcePath);
        const content = readFile(fullPath) || "";
        // @skip-test チェック
        const skipTest = extractSkipTest(content);
        if (skipTest) {
            linkedSources.push({
                path: sourcePath,
                testCount: 0,
                testCases: [],
                status: "skipped",
                skipReason: skipTest.reason,
            });
            continue;
        }
        // 期待されるテストパスを取得
        const expectedTestPath = getExpectedTestPath(sourcePath, conventions);
        let foundTestFile;
        let foundTestCases = [];
        if (expectedTestPath) {
            // 完全一致を試す
            for (const [testPath, cases] of testFileToTestCases) {
                if (testPath === expectedTestPath || testPath.endsWith(basename(expectedTestPath))) {
                    foundTestFile = testPath;
                    foundTestCases = cases.map((tc) => ({ ...tc, sourceFile: sourcePath }));
                    matchedTestFiles.add(testPath);
                    break;
                }
            }
            // 部分一致を試す (ファイル名ベース)
            if (!foundTestFile) {
                const sourceBaseName = basename(sourcePath, ".ts").replace(".tsx", "");
                const expectedTestName = `${sourceBaseName}.test.ts`;
                for (const [testPath, cases] of testFileToTestCases) {
                    if (basename(testPath) === expectedTestName || basename(testPath) === `${sourceBaseName}.test.tsx`) {
                        foundTestFile = testPath;
                        foundTestCases = cases.map((tc) => ({ ...tc, sourceFile: sourcePath }));
                        matchedTestFiles.add(testPath);
                        break;
                    }
                }
            }
        }
        linkedSources.push({
            path: sourcePath,
            testFile: foundTestFile,
            testCount: foundTestCases.length,
            testCases: foundTestCases,
            status: foundTestFile ? "covered" : "missing",
        });
    }
    // 孤立テストを収集
    for (const [testPath, cases] of testFileToTestCases) {
        if (!matchedTestFiles.has(testPath)) {
            orphanTests.push(...cases.map((tc) => ({ ...tc, sourceFile: undefined })));
        }
    }
    // サマリーを計算
    const totalSources = linkedSources.length;
    const coveredCount = linkedSources.filter((s) => s.status === "covered").length;
    const skippedCount = linkedSources.filter((s) => s.status === "skipped").length;
    const missingCount = linkedSources.filter((s) => s.status === "missing").length;
    const totalTestCases = linkedSources.reduce((sum, s) => sum + s.testCases.length, 0);
    const orphanTestCases = orphanTests.length;
    const coveragePercent = totalSources > 0
        ? Math.round(((coveredCount + skippedCount) / totalSources) * 100)
        : 100;
    return {
        linkedSources,
        orphanTests,
        summary: {
            totalSources,
            coveredCount,
            skippedCount,
            missingCount,
            totalTestCases,
            orphanTestCases,
            coveragePercent,
        },
        generatedAt: new Date().toISOString(),
    };
}
/**
 * 統合ビュー HTML を生成
 */
function generateLinkedDocsHtml(report, projectName) {
    // サイドバー HTML
    const sidebarHtml = buildSidebar(report);
    // メインコンテンツ HTML
    const contentHtml = buildContent(report);
    const styles = getStyles();
    const scripts = getScripts();
    const content = `
    <div class="header">
      <a href="index.html" class="back-link">
        ${icons.back}
        ポータルに戻る
      </a>
      <div class="header-title">
        <h1>API-テスト関連付けビュー</h1>
      </div>
      <div class="search-box">
        <input type="text" class="search-input" id="searchInput" placeholder="検索...">
      </div>
    </div>
    <div class="main-container">
      ${sidebarHtml}
      <main class="content">
        ${buildSummaryCard(report)}
        ${contentHtml}
      </main>
    </div>
  `;
    return wrapHtmlDocument({
        title: `API-テスト関連付け - ${projectName}`,
        content,
        styles,
        scripts,
    });
}
/**
 * サイドバー HTML を生成
 */
function buildSidebar(report) {
    const coveredSources = report.linkedSources.filter((s) => s.status === "covered");
    const missingSources = report.linkedSources.filter((s) => s.status === "missing");
    const skippedSources = report.linkedSources.filter((s) => s.status === "skipped");
    const buildNavItems = (sources, statusClass) => {
        return sources
            .map((source) => {
            const id = fileToId(source.path);
            const name = basename(source.path);
            return `
          <li class="nav-item">
            <a href="#${id}" class="nav-link ${statusClass}" title="${escapeHtml(source.path)}">
              <span class="nav-status"></span>
              ${escapeHtml(name)}
              ${source.testCount > 0 ? `<span class="nav-count">${source.testCount}</span>` : ""}
            </a>
          </li>
        `;
        })
            .join("\n");
    };
    return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title">実装ファイル</div>
      </div>
      ${coveredSources.length > 0
        ? `
        <div class="nav-group">
          <div class="nav-group-title">
            <span class="badge badge-covered">テスト済み</span>
            <span class="badge-count">${coveredSources.length}</span>
          </div>
          <ul class="nav-list">
            ${buildNavItems(coveredSources, "status-covered")}
          </ul>
        </div>
      `
        : ""}
      ${missingSources.length > 0
        ? `
        <div class="nav-group">
          <div class="nav-group-title">
            <span class="badge badge-missing">未テスト</span>
            <span class="badge-count">${missingSources.length}</span>
          </div>
          <ul class="nav-list">
            ${buildNavItems(missingSources, "status-missing")}
          </ul>
        </div>
      `
        : ""}
      ${skippedSources.length > 0
        ? `
        <div class="nav-group">
          <div class="nav-group-title">
            <span class="badge badge-skipped">スキップ</span>
            <span class="badge-count">${skippedSources.length}</span>
          </div>
          <ul class="nav-list">
            ${buildNavItems(skippedSources, "status-skipped")}
          </ul>
        </div>
      `
        : ""}
      ${report.orphanTests.length > 0
        ? `
        <div class="nav-group">
          <div class="nav-group-title">
            <span class="badge badge-orphan">孤立テスト</span>
            <span class="badge-count">${report.orphanTests.length}</span>
          </div>
          <ul class="nav-list">
            <li class="nav-item">
              <a href="#orphan-tests" class="nav-link status-orphan">
                孤立テストケース一覧
              </a>
            </li>
          </ul>
        </div>
      `
        : ""}
    </aside>
  `;
}
/**
 * メインコンテンツ HTML を生成
 */
function buildContent(report) {
    const sections = [];
    // カバー済みソース
    for (const source of report.linkedSources.filter((s) => s.status === "covered")) {
        sections.push(buildSourceSection(source));
    }
    // 未テストソース
    for (const source of report.linkedSources.filter((s) => s.status === "missing")) {
        sections.push(buildSourceSection(source));
    }
    // スキップソース
    for (const source of report.linkedSources.filter((s) => s.status === "skipped")) {
        sections.push(buildSourceSection(source));
    }
    // 孤立テスト
    if (report.orphanTests.length > 0) {
        sections.push(buildOrphanTestsSection(report.orphanTests));
    }
    return sections.join("\n");
}
/**
 * ソースファイルセクションを生成
 */
function buildSourceSection(source) {
    const id = fileToId(source.path);
    const statusClass = `status-${source.status}`;
    const statusLabel = source.status === "covered"
        ? "テスト済み"
        : source.status === "missing"
            ? "未テスト"
            : "スキップ";
    const testCasesHtml = source.testCases.length > 0
        ? `
    <div class="test-cases">
      <h4 class="test-cases-title">テストケース (${source.testCases.length}件)</h4>
      <ul class="test-list">
        ${source.testCases
            .map((tc) => `
          <li class="test-item ${tc.description ? "has-doc" : ""}">
            <div class="test-header">
              <span class="test-name">${escapeHtml(tc.description || tc.it)}</span>
              <div class="test-meta">
                ${tc.bdd?.given || tc.bdd?.when || tc.bdd?.then ? '<span class="test-bdd-badge">BDD</span>' : ""}
                <span class="test-line">L${tc.line}</span>
              </div>
            </div>
            ${tc.description && tc.it !== tc.description ? `<div class="test-original">EN: ${escapeHtml(tc.it)}</div>` : ""}
            ${tc.purpose ? `<div class="test-detail"><span class="detail-label">目的:</span> ${escapeHtml(tc.purpose)}</div>` : ""}
            ${tc.expected ? `<div class="test-detail"><span class="detail-label">期待:</span> ${escapeHtml(tc.expected)}</div>` : ""}
          </li>
        `)
            .join("")}
      </ul>
    </div>
  `
        : source.status === "missing"
            ? '<div class="no-tests">テストファイルが見つかりません</div>'
            : "";
    const skipReasonHtml = source.skipReason
        ? `<div class="skip-reason"><span class="skip-label">スキップ理由:</span> ${escapeHtml(source.skipReason)}</div>`
        : "";
    return `
    <section id="${id}" class="source-section ${statusClass}">
      <div class="source-header">
        <span class="badge badge-${source.status}">${statusLabel}</span>
        <h3 class="source-path">${escapeHtml(source.path)}</h3>
        ${source.testFile ? `<span class="test-file-link" title="${escapeHtml(source.testFile)}">-> ${escapeHtml(basename(source.testFile))}</span>` : ""}
      </div>
      ${skipReasonHtml}
      ${testCasesHtml}
    </section>
  `;
}
/**
 * 孤立テストセクションを生成
 */
function buildOrphanTestsSection(orphanTests) {
    // ファイルごとにグループ化
    const byFile = new Map();
    for (const tc of orphanTests) {
        const existing = byFile.get(tc.file) || [];
        existing.push(tc);
        byFile.set(tc.file, existing);
    }
    const filesHtml = Array.from(byFile.entries())
        .map(([file, cases]) => `
    <div class="orphan-file">
      <h4 class="orphan-file-path">${escapeHtml(file)}</h4>
      <ul class="test-list">
        ${cases
        .map((tc) => `
          <li class="test-item">
            <span class="test-name">${escapeHtml(tc.description || tc.it)}</span>
            <span class="test-line">L${tc.line}</span>
          </li>
        `)
        .join("")}
      </ul>
    </div>
  `)
        .join("");
    return `
    <section id="orphan-tests" class="orphan-section">
      <div class="orphan-header">
        <span class="badge badge-orphan">孤立テスト</span>
        <h3>対応する実装ファイルが見つからないテスト (${orphanTests.length}件)</h3>
      </div>
      <p class="orphan-description">
        これらのテストは規約に基づくソースファイルが見つかりませんでした。
        リファクタリングや削除を検討してください。
      </p>
      ${filesHtml}
    </section>
  `;
}
/**
 * サマリーカード HTML を生成
 */
function buildSummaryCard(report) {
    const { summary } = report;
    const coverageClass = summary.coveragePercent >= 80
        ? "coverage-high"
        : summary.coveragePercent >= 50
            ? "coverage-medium"
            : "coverage-low";
    return `
    <div class="summary-card">
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${summary.totalSources}</div>
          <div class="summary-label">実装ファイル</div>
        </div>
        <div class="summary-item summary-covered">
          <div class="summary-value">${summary.coveredCount}</div>
          <div class="summary-label">テスト済み</div>
        </div>
        <div class="summary-item summary-missing">
          <div class="summary-value">${summary.missingCount}</div>
          <div class="summary-label">未テスト</div>
        </div>
        <div class="summary-item summary-skipped">
          <div class="summary-value">${summary.skippedCount}</div>
          <div class="summary-label">スキップ</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${summary.totalTestCases}</div>
          <div class="summary-label">テストケース</div>
        </div>
        <div class="summary-item ${coverageClass}">
          <div class="summary-value">${summary.coveragePercent}%</div>
          <div class="summary-label">カバレッジ</div>
        </div>
      </div>
      <div class="summary-meta">
        生成日時: ${new Date(report.generatedAt).toLocaleString("ja-JP")}
      </div>
    </div>
  `;
}
/**
 * ファイルパスを ID に変換
 */
function fileToId(file) {
    return "src-" + file.replace(/[^a-zA-Z0-9]/g, "-");
}
/**
 * スタイル
 */
function getStyles() {
    return `
    .header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .header-title {
      flex: 1;
    }

    .header-title h1 {
      font-size: 1.25rem;
      margin: 0;
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
      width: 250px;
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

    .search-input:focus {
      outline: none;
      border-color: var(--accent-blue);
    }

    .main-container {
      display: flex;
      min-height: calc(100vh - 60px);
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
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem 0.375rem 1.5rem;
      color: var(--text-secondary);
      text-decoration: none;
      border-radius: 4px;
      font-size: 0.8rem;
      transition: all 0.15s ease;
    }

    .nav-link:hover {
      background: var(--border-color);
      color: var(--text-primary);
      text-decoration: none;
    }

    .nav-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .status-covered .nav-status { background: var(--accent-green); }
    .status-missing .nav-status { background: #ef4444; }
    .status-skipped .nav-status { background: var(--accent-orange); }
    .status-orphan .nav-status { background: var(--accent-purple); }

    .nav-count {
      margin-left: auto;
      font-size: 0.7rem;
      background: var(--bg-color);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      color: var(--text-secondary);
    }

    .content {
      flex: 1;
      padding: 2rem;
      max-width: 900px;
    }

    .badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-covered { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
    .badge-missing { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .badge-skipped { background: rgba(249, 115, 22, 0.2); color: #f97316; }
    .badge-orphan { background: rgba(168, 85, 247, 0.2); color: #a855f7; }

    .badge-count {
      color: var(--text-secondary);
      font-size: 0.75rem;
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
      grid-template-columns: repeat(6, 1fr);
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
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .summary-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
    }

    .summary-covered .summary-value { color: #22c55e; }
    .summary-missing .summary-value { color: #ef4444; }
    .summary-skipped .summary-value { color: #f97316; }

    .coverage-high .summary-value { color: #22c55e; }
    .coverage-medium .summary-value { color: #eab308; }
    .coverage-low .summary-value { color: #ef4444; }

    .summary-meta {
      text-align: right;
      font-size: 0.8rem;
      color: var(--text-secondary);
    }

    .source-section {
      margin-bottom: 2rem;
      padding: 1rem;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }

    .source-section.status-covered {
      border-left: 3px solid #22c55e;
    }

    .source-section.status-missing {
      border-left: 3px solid #ef4444;
    }

    .source-section.status-skipped {
      border-left: 3px solid #f97316;
    }

    .source-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border-color);
    }

    .source-path {
      flex: 1;
      font-size: 0.9rem;
      font-family: monospace;
      color: var(--accent-blue);
      margin: 0;
    }

    .test-file-link {
      font-size: 0.75rem;
      color: var(--text-secondary);
      font-family: monospace;
    }

    .skip-reason {
      background: rgba(249, 115, 22, 0.1);
      padding: 0.75rem;
      border-radius: 6px;
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }

    .skip-label {
      font-weight: 600;
      color: #f97316;
    }

    .no-tests {
      padding: 1rem;
      text-align: center;
      color: var(--text-secondary);
      background: rgba(239, 68, 68, 0.05);
      border-radius: 6px;
    }

    .test-cases-title {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-bottom: 0.75rem;
    }

    .test-list {
      list-style: none;
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

    .test-item.has-doc {
      background: rgba(168, 85, 247, 0.05);
      border-color: rgba(168, 85, 247, 0.2);
    }

    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .test-name {
      color: var(--text-primary);
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

    .test-bdd-badge {
      font-size: 0.6rem;
      padding: 0.125rem 0.375rem;
      background: rgba(34, 197, 94, 0.2);
      color: var(--accent-green);
      border-radius: 3px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .test-original {
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
      font-style: italic;
    }

    .test-detail {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
    }

    .detail-label {
      font-weight: 600;
      color: var(--accent-purple);
    }

    .orphan-section {
      margin-bottom: 2rem;
      padding: 1rem;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-left: 3px solid #a855f7;
      border-radius: 8px;
    }

    .orphan-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .orphan-header h3 {
      font-size: 0.9rem;
      margin: 0;
    }

    .orphan-description {
      color: var(--text-secondary);
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }

    .orphan-file {
      margin-bottom: 1rem;
    }

    .orphan-file-path {
      font-size: 0.85rem;
      font-family: monospace;
      color: var(--accent-purple);
      margin-bottom: 0.5rem;
    }

    .hidden {
      display: none !important;
    }

    @media (max-width: 1024px) {
      .summary-grid {
        grid-template-columns: repeat(3, 1fr);
      }
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
 * スクリプト
 */
function getScripts() {
    return `
    const searchInput = document.getElementById('searchInput');
    const sections = document.querySelectorAll('.source-section, .orphan-section');
    const navItems = document.querySelectorAll('.nav-item');

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();

      sections.forEach((section) => {
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
//# sourceMappingURL=link-docs.js.map