/**
 * ポータルジェネレーター（Handlebars ベース）
 *
 * Handlebars テンプレートを使用して静的 HTML ポータルを生成する。
 * Next.js / React 依存を完全に除去したスタンドアロン実装。
 */
import { existsSync, mkdirSync, writeFileSync, readdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { registerHelpers } from "./helpers.js";
import { registerPartials, templatesExist, getTemplatesDirPath } from "./renderer.js";
import { loadPortalData } from "./data-processor.js";
import { buildSidebarData } from "./sidebar-builder.js";
import { wrapWithLayout } from "./layout-builder.js";
// ページジェネレーター
import { generateHomePage } from "./pages/home.js";
import { generateOverviewPage } from "./pages/overview.js";
import { generateFeatureMapPage, generateFeatureMapAppPage, } from "./pages/feature-map.js";
import { generateTestCasesPage, generateTestCasesFilePage, generateTestCaseDetailPage, } from "./pages/test-cases.js";
import { generateDbSchemaPage, generateDbSchemaDbPage, generateDbSchemaTablePage, generateDbDiagramPage, } from "./pages/db-schema.js";
import { generateI18nPage, generateI18nNamespacePage } from "./pages/i18n.js";
import { generatePackagesPage, generatePackageDetailPage, } from "./pages/packages.js";
import { generateApiToolsPage } from "./pages/api-tools.js";
import { generateDetailsModulePage, generateDetailsItemPage, getItemsByType, } from "./pages/details.js";
import { generateAppsHomePage } from "./pages/apps.js";
import { generateSearchIndex } from "./search-index-generator.js";
/**
 * Handlebars ベースのポータルジェネレーター
 */
export class PortalGenerator {
    options;
    data = null;
    constructor(options) {
        this.options = options;
    }
    /**
     * ポータルを生成する
     */
    async generate() {
        const { outputDir, projectPath, projectName, verbose } = this.options;
        // テンプレートの存在確認
        if (!templatesExist()) {
            throw new Error(`ポータルテンプレートが見つかりません: ${getTemplatesDirPath()}`);
        }
        this.log("Handlebars ヘルパーを登録中...", verbose);
        registerHelpers();
        this.log("パーシャルを登録中...", verbose);
        registerPartials();
        this.log("データを読み込み中...", verbose);
        this.data = loadPortalData(outputDir, projectName, projectPath);
        this.log("検索インデックスを生成中...", verbose);
        this.generateSearchIndex(outputDir);
        this.log("ページを生成中...", verbose);
        const pages = this.buildAllPages();
        this.log(`${pages.length} ページを書き出し中...`, verbose);
        this.writePages(pages, outputDir);
        this.log("アセットをコピー中...", verbose);
        this.copyAssets(outputDir);
        this.log(`ポータルを生成しました: ${outputDir}`, verbose);
    }
    /**
     * 全ページを生成する
     */
    buildAllPages() {
        if (!this.data) {
            throw new Error("data が初期化されていません。generate() を先に呼び出してください。");
        }
        const pages = [];
        const data = this.data;
        const sidebarSections = buildSidebarData(data);
        const wrap = (title, content, path, breadcrumbs) => wrapWithLayout({
            title: `${title} | ${data.projectName}`,
            projectName: data.projectName,
            sidebarSections,
            content,
            breadcrumbs,
            currentPath: path,
        });
        // ホームページ
        pages.push({
            outputPath: "index.html",
            html: wrap(data.projectName, generateHomePage(data), "/"),
        });
        // 概要ページ
        if (data.available.hasOverview) {
            pages.push({
                outputPath: "overview/index.html",
                html: wrap("概要", generateOverviewPage(data), "/overview", [{ label: "概要" }]),
            });
        }
        // 機能マップ
        if (data.available.hasFeatureMap) {
            pages.push({
                outputPath: "feature-map/index.html",
                html: wrap("機能マップ", generateFeatureMapPage(data), "/feature-map", [{ label: "機能マップ" }]),
            });
        }
        // DB スキーマ
        if (data.available.hasDbSchema && data.dbSchema) {
            pages.push({
                outputPath: "db-schema/index.html",
                html: wrap("DB スキーマ", generateDbSchemaPage(data), "/db-schema", [{ label: "DB スキーマ" }]),
            });
            // ER 図
            pages.push({
                outputPath: "db-schema/diagram/index.html",
                html: wrap("ER 図", generateDbDiagramPage(data), "/db-schema/diagram", [{ label: "DB スキーマ", href: "/db-schema" }, { label: "ER 図" }]),
            });
            // 複数 DB の場合はDB別ページ
            if (data.dbSchema.databases && data.dbSchema.databases.length > 1) {
                for (const db of data.dbSchema.databases) {
                    const dbSlug = encodeURIComponent(db.name);
                    pages.push({
                        outputPath: `db-schema/${dbSlug}/index.html`,
                        html: wrap(`DB: ${db.name}`, generateDbSchemaDbPage(data, db.name), `/db-schema/${dbSlug}`, [
                            { label: "DB スキーマ", href: "/db-schema" },
                            { label: db.name },
                        ]),
                    });
                    pages.push({
                        outputPath: `db-schema/${dbSlug}/diagram/index.html`,
                        html: wrap(`ER 図: ${db.name}`, generateDbDiagramPage(data, db.name), `/db-schema/${dbSlug}/diagram`, [
                            { label: "DB スキーマ", href: "/db-schema" },
                            { label: db.name, href: `/db-schema/${dbSlug}` },
                            { label: "ER 図" },
                        ]),
                    });
                }
            }
            // テーブル詳細
            for (const table of data.dbSchema.tables) {
                const tableSlug = encodeURIComponent(table.name);
                pages.push({
                    outputPath: `db-schema/${tableSlug}/index.html`,
                    html: wrap(`テーブル: ${table.name}`, generateDbSchemaTablePage(data, table.name), `/db-schema/${tableSlug}`, [
                        { label: "DB スキーマ", href: "/db-schema" },
                        { label: table.name },
                    ]),
                });
            }
        }
        // テストケース
        if (data.available.hasTestCases && data.testCases) {
            pages.push({
                outputPath: "test-cases/index.html",
                html: wrap("テストケース", generateTestCasesPage(data), "/test-cases", [{ label: "テストケース" }]),
            });
            // ファイル別ページ
            const files = [
                ...new Set(data.testCases.testCases.map((tc) => tc.file)),
            ];
            for (const file of files) {
                const fileSlug = encodeURIComponent(file);
                pages.push({
                    outputPath: `test-cases/${fileSlug}/index.html`,
                    html: wrap(`テスト: ${file.split("/").pop()}`, generateTestCasesFilePage(data, fileSlug), `/test-cases/${fileSlug}`, [
                        { label: "テストケース", href: "/test-cases" },
                        { label: file.split("/").pop() || file },
                    ]),
                });
                // テスト詳細（行番号別）
                const testsInFile = data.testCases.testCases.filter((tc) => tc.file === file);
                for (const test of testsInFile) {
                    pages.push({
                        outputPath: `test-cases/${fileSlug}/${test.line}/index.html`,
                        html: wrap(test.it, generateTestCaseDetailPage(data, fileSlug, test.line), `/test-cases/${fileSlug}/${test.line}`, [
                            { label: "テストケース", href: "/test-cases" },
                            {
                                label: file.split("/").pop() || file,
                                href: `/test-cases/${fileSlug}`,
                            },
                            { label: test.it },
                        ]),
                    });
                }
            }
        }
        // i18n
        if (data.available.hasI18n && data.i18n) {
            pages.push({
                outputPath: "i18n/index.html",
                html: wrap("i18n", generateI18nPage(data), "/i18n", [
                    { label: "i18n" },
                ]),
            });
            for (const ns of data.i18n.namespaces) {
                const nsSlug = encodeURIComponent(ns.name);
                pages.push({
                    outputPath: `i18n/${nsSlug}/index.html`,
                    html: wrap(`i18n: ${ns.name}`, generateI18nNamespacePage(data, ns.name), `/i18n/${nsSlug}`, [{ label: "i18n", href: "/i18n" }, { label: ns.name }]),
                });
            }
        }
        // パッケージ
        if (data.available.hasPackages && data.packages) {
            pages.push({
                outputPath: "packages/index.html",
                html: wrap("パッケージ", generatePackagesPage(data), "/packages", [{ label: "パッケージ" }]),
            });
            for (const pkg of data.packages.packages) {
                const pkgSlug = encodeURIComponent(pkg.name);
                pages.push({
                    outputPath: `packages/${pkgSlug}/index.html`,
                    html: wrap(`パッケージ: ${pkg.name}`, generatePackageDetailPage(data, pkg.name), `/packages/${pkgSlug}`, [
                        { label: "パッケージ", href: "/packages" },
                        { label: pkg.name },
                    ]),
                });
            }
        }
        // API ツール
        if (data.available.hasApiTools) {
            pages.push({
                outputPath: "api-tools/index.html",
                html: wrap("API ツール", generateApiToolsPage(data), "/api-tools", [{ label: "API ツール" }]),
            });
        }
        // 詳細ページ（feature-map から生成）
        if (data.available.hasFeatureMap && data.featureMap) {
            const types = ["screen", "component", "action", "module", "table"];
            const allModules = [
                ...Object.keys(data.featureMap.features),
                "Uncategorized",
            ];
            for (const type of types) {
                for (const moduleName of allModules) {
                    const moduleSlug = encodeURIComponent(moduleName);
                    pages.push({
                        outputPath: `details/${type}/${moduleSlug}/index.html`,
                        html: wrap(`${moduleName} - ${type}`, generateDetailsModulePage(data, type, moduleName), `/details/${type}/${moduleSlug}`, [
                            { label: "詳細" },
                            { label: type },
                            { label: moduleName },
                        ]),
                    });
                    // アイテム詳細ページ
                    const group = moduleName === "Uncategorized"
                        ? data.featureMap.uncategorized
                        : data.featureMap.features[moduleName];
                    if (group) {
                        const items = getItemsByType(group, type);
                        for (const item of items) {
                            const itemSlug = encodeURIComponent(item.name);
                            pages.push({
                                outputPath: `details/${type}/${moduleSlug}/${itemSlug}/index.html`,
                                html: wrap(item.name, generateDetailsItemPage(data, type, moduleName, item.name), `/details/${type}/${moduleSlug}/${itemSlug}`, [
                                    { label: "詳細" },
                                    {
                                        label: `${moduleName} (${type})`,
                                        href: `/details/${type}/${moduleSlug}`,
                                    },
                                    { label: item.name },
                                ]),
                            });
                        }
                    }
                }
            }
        }
        // アプリケーションページ
        if (data.available.hasApplications && data.applications) {
            for (const app of data.applications.apps) {
                const appSlug = encodeURIComponent(app.id);
                pages.push({
                    outputPath: `apps/${appSlug}/index.html`,
                    html: wrap(app.name, generateAppsHomePage(data, app.id), `/apps/${appSlug}`, [{ label: "アプリ" }, { label: app.name }]),
                });
                // アプリ別機能マップ
                if (data.available.hasFeatureMap) {
                    pages.push({
                        outputPath: `apps/${appSlug}/feature-map/index.html`,
                        html: wrap(`${app.name} - 機能マップ`, generateFeatureMapAppPage(data, app.id), `/apps/${appSlug}/feature-map`, [
                            { label: "アプリ" },
                            { label: app.name, href: `/apps/${appSlug}` },
                            { label: "機能マップ" },
                        ]),
                    });
                }
            }
        }
        return pages;
    }
    /**
     * 検索インデックスを生成して保存する
     */
    generateSearchIndex(outputDir) {
        if (!this.data)
            return;
        const existingPath = join(outputDir, "search-index.json");
        if (existsSync(existingPath))
            return; // 既存インデックスを使用
        const index = generateSearchIndex(this.data.featureMap, this.data.dbSchema, this.data.testCases, this.data.details);
        writeFileSync(existingPath, JSON.stringify(index, null, 2), "utf-8");
    }
    /**
     * ページ HTML をファイルシステムに書き出す
     */
    writePages(pages, outputDir) {
        for (const page of pages) {
            const filePath = join(outputDir, page.outputPath);
            const dir = dirname(filePath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(filePath, page.html, "utf-8");
        }
    }
    /**
     * テンプレートの assets/ を出力先にコピーする
     */
    copyAssets(outputDir) {
        // テンプレートディレクトリは getTemplatesDirPath() で取得
        // assets/ をポータル出力先にコピー
        const assetsDir = join(getTemplatesDirPath(), "assets");
        if (!existsSync(assetsDir))
            return;
        const destDir = join(outputDir, "assets");
        if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
        }
        const files = readdirSync(assetsDir);
        for (const file of files) {
            copyFileSync(join(assetsDir, file), join(destDir, file));
        }
    }
    log(message, verbose) {
        if (verbose) {
            console.log(`  [portal] ${message}`);
        }
    }
}
//# sourceMappingURL=index.js.map