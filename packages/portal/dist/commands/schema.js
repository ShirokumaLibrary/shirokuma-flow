/**
 * schema コマンド - DB スキーマドキュメント生成 (DBML, SVG)
 *
 * Drizzle ORM スキーマから以下を生成:
 * - schema.dbml - DBML ソースファイル
 * - schema.svg - ER 図 (SVG)
 * - schema-docs.md - テーブル説明 Markdown
 */
import { resolve, basename } from "node:path";
import { rmSync } from "node:fs";
import { loadConfig, getOutputPath, resolvePath } from "../utils/config.js";
import { ensureDir, fileExists, writeFile, readFile, listFiles, } from "../utils/file.js";
import { createLogger } from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import { extractDbSchemaJsDocs } from "../parsers/jsdoc-common.js";
import { parseDrizzleSchemaDir, toPortalDbSchema, } from "../parsers/drizzle-schema.js";
import { isPackageInstalled, isBinaryInPath } from "../utils/package-check.js";
import { execFileAsync, spawnAsync } from "../utils/spawn-async.js";
/**
 * パスからDB名を取得
 *
 * @example
 * getDbNameFromPath("packages/database/src/schema") // -> "database"
 * getDbNameFromPath("packages/analytics-db/src/schema") // -> "analytics-db"
 * getDbNameFromPath("./src/schema") // -> "schema"
 */
export function getDbNameFromPath(path) {
    const parts = path.split("/").filter((p) => p && p !== ".");
    // "packages" の次のディレクトリ名を使用
    const packagesIndex = parts.indexOf("packages");
    if (packagesIndex !== -1 && parts[packagesIndex + 1]) {
        return parts[packagesIndex + 1];
    }
    // フォールバック: 最初の意味のあるディレクトリ名
    // src, schema を除外して探す
    const excludeNames = ["src", "schema"];
    const meaningfulPart = parts.find((p) => !excludeNames.includes(p));
    return meaningfulPart || "default";
}
/**
 * 設定から正規化されたスキーマ設定リストを取得
 */
export function normalizeSchemaConfigs(config, projectPath) {
    const schemaConfig = config.schema;
    const defaultPattern = "*.ts";
    // sources が未定義または空配列の場合
    if (!schemaConfig?.sources || schemaConfig.sources.length === 0) {
        return [];
    }
    return schemaConfig.sources.map((src) => {
        const dbName = getDbNameFromPath(src.path);
        const sourcePath = resolvePath(projectPath, src.path);
        const outputPath = resolve(getOutputPath(config, projectPath, "generated"), "schema", dbName);
        return {
            name: dbName,
            description: src.description,
            source: sourcePath,
            output: outputPath,
            pattern: schemaConfig.pattern ?? defaultPattern,
        };
    });
}
/**
 * schema コマンドハンドラ
 */
export async function schemaCommand(options) {
    const logger = createLogger(options.verbose);
    const projectPath = resolve(options.project);
    logger.info(t("commands.schema.generating"));
    // 設定読み込み
    const config = loadConfig(projectPath, options.config);
    // 正規化されたスキーマ設定リストを取得
    const schemaConfigs = normalizeSchemaConfigs(config, projectPath);
    if (schemaConfigs.length === 0) {
        logger.warn(t("commands.schema.noSchemaSource"));
        return 0;
    }
    // パッケージの存在確認
    const packageStatus = checkPackages(projectPath, logger);
    // 複数DB対応: 各DBごとに処理
    const allDatabases = [];
    const allTables = [];
    for (let i = 0; i < schemaConfigs.length; i++) {
        const schemaConfig = schemaConfigs[i];
        const dbLabel = schemaConfigs.length > 1 ? ` [${schemaConfig.name}]` : "";
        logger.info(`\n--- データベース: ${schemaConfig.name}${schemaConfig.description ? ` (${schemaConfig.description})` : ""} ---`);
        // ソースディレクトリ確認
        if (!fileExists(schemaConfig.source)) {
            logger.error(`スキーマソースが見つかりません: ${schemaConfig.source}`);
            continue; // 複数DBの場合は次へ進む
        }
        logger.debug(`スキーマソース: ${schemaConfig.source}`);
        // 出力ディレクトリ
        ensureDir(schemaConfig.output);
        logger.debug(t("commands.schema.outputDirDebug", { output: schemaConfig.output }));
        // Step 1: DBML 生成
        let dbmlPath = null;
        if (packageStatus.dbmlGenerator) {
            logger.step(1, 3, t("commands.schema.stepDbmlGenerate", { label: dbLabel }));
            dbmlPath = await generateDbml(projectPath, schemaConfig.source, schemaConfig.output, logger, options.verbose);
        }
        else {
            logger.step(1, 3, t("commands.schema.stepDbmlSkipped", { label: dbLabel }));
        }
        // Step 2: SVG 生成
        if (dbmlPath && fileExists(dbmlPath)) {
            logger.step(2, 3, t("commands.schema.stepSvgGenerate", { label: dbLabel }));
            await generateSvg(projectPath, dbmlPath, schemaConfig.output, packageStatus, logger, options.verbose);
        }
        else {
            logger.step(2, 3, t("commands.schema.stepSvgSkipped", { label: dbLabel }));
        }
        // Step 3: スキーマドキュメント生成
        logger.step(3, 3, t("commands.schema.stepSchemaDoc", { label: dbLabel }));
        const dbTables = generateSchemaIndex(schemaConfig.source, schemaConfig.output, dbmlPath, logger, schemaConfig.name);
        // テーブル情報を集約（単一DBでも常に実行）
        if (dbTables) {
            allDatabases.push({
                name: schemaConfig.name,
                description: schemaConfig.description,
                tableCount: dbTables.length,
            });
            // テーブルにデータベース名を付与
            for (const table of dbTables) {
                allTables.push({
                    ...table,
                    database: schemaConfig.name,
                });
            }
        }
        logger.success(t("commands.schema.schemaDone", { label: dbLabel }));
        logger.info(t("commands.schema.outputDir", { output: schemaConfig.output }));
    }
    // 統合JSONを出力（単一DBでも常に実行）
    if (allTables.length > 0) {
        const portalDir = resolve(getOutputPath(config, projectPath, "portal"));
        ensureDir(portalDir);
        const combinedSchema = {
            databases: allDatabases,
            tables: allTables,
            generatedAt: new Date().toISOString(),
        };
        const combinedJsonPath = resolve(portalDir, "db-schema.json");
        writeFile(combinedJsonPath, JSON.stringify(combinedSchema, null, 2));
        logger.success(`統合ポータルJSON: ${combinedJsonPath}`);
    }
    return 0;
}
/**
 * パッケージの存在確認
 */
function checkPackages(projectPath, logger) {
    const status = {
        dbmlGenerator: false,
        dbmlRenderer: false,
    };
    // drizzle-dbml-generator 確認
    if (isPackageInstalled(projectPath, "drizzle-dbml-generator")) {
        status.dbmlGenerator = true;
        logger.debug("drizzle-dbml-generator: インストール済み");
    }
    else {
        logger.warn(t("commands.schema.dbmlGeneratorNotInstalled"));
        logger.info(t("commands.schema.dbmlGeneratorInstallHint"));
    }
    // @softwaretechnik/dbml-renderer 確認
    if (isPackageInstalled(projectPath, "@softwaretechnik/dbml-renderer")) {
        status.dbmlRenderer = true;
        logger.debug("@softwaretechnik/dbml-renderer: インストール済み");
    }
    else {
        // グローバルにインストールされているか確認
        if (isBinaryInPath("dbml-renderer")) {
            status.dbmlRenderer = true;
            logger.debug("dbml-renderer: グローバルインストール済み");
        }
        else {
            logger.warn(t("commands.schema.dbmlRendererNotInstalled"));
            logger.info(t("commands.schema.dbmlRendererInstallHint"));
            logger.info(t("commands.schema.dbmlRendererInstallGlobalHint"));
        }
    }
    return status;
}
/**
 * DBML を生成
 */
async function generateDbml(projectPath, schemaSource, outputDir, logger, verbose) {
    const scriptPath = resolve(outputDir, "_generate-dbml.mjs");
    const dbmlPath = resolve(outputDir, "schema.dbml");
    // スキーマの index.ts または index.js を探す
    const indexTs = resolve(schemaSource, "index.ts");
    const indexJs = resolve(schemaSource, "index.js");
    let schemaImportPath;
    if (fileExists(indexTs)) {
        // TypeScript の場合、トランスパイルが必要
        // tsx を使用するか、既にビルドされた js を使用
        schemaImportPath = schemaSource;
    }
    else if (fileExists(indexJs)) {
        schemaImportPath = schemaSource;
    }
    else {
        logger.warn(t("commands.schema.indexNotFound", { schemaSource }));
        return null;
    }
    // 生成スクリプト作成
    const scriptContent = `
import { pgGenerate } from 'drizzle-dbml-generator';

// スキーマをインポート
// Note: TypeScript の場合は tsx で実行するか、ビルド済みの js を使用
const schemaModule = await import('${schemaImportPath}/index.js');

// default export または named export を取得
const schema = schemaModule.default || schemaModule;

// DBML 生成
const dbml = pgGenerate({ schema, relational: true });
console.log(dbml);
`;
    writeFile(scriptPath, scriptContent);
    logger.debug(`生成スクリプト: ${scriptPath}`);
    // スクリプト実行
    const nodeResult = await execFileAsync("node", [scriptPath], {
        cwd: projectPath,
    });
    if (verbose && nodeResult.stderr) {
        process.stderr.write(nodeResult.stderr);
    }
    if (nodeResult.exitCode === 0 && nodeResult.stdout) {
        writeFile(dbmlPath, nodeResult.stdout);
        logger.success(`DBML: ${dbmlPath}`);
        // 一時スクリプト削除
        rmSync(scriptPath, { force: true });
        return dbmlPath;
    }
    // tsx を使って再試行
    logger.debug("node での実行失敗、tsx で再試行");
    const tsxScriptContent = `
import { pgGenerate } from 'drizzle-dbml-generator';
import * as schema from '${schemaImportPath}/index.js';

// DBML 生成
const dbml = pgGenerate({ schema, relational: true });
console.log(dbml);
`;
    writeFile(scriptPath, tsxScriptContent);
    // npx tsx を使用
    const tsxResult = await execFileAsync("npx", ["tsx", scriptPath], {
        cwd: projectPath,
    });
    if (verbose && tsxResult.stderr) {
        process.stderr.write(tsxResult.stderr);
    }
    // 一時スクリプト削除
    rmSync(scriptPath, { force: true });
    if (tsxResult.exitCode === 0 && tsxResult.stdout) {
        writeFile(dbmlPath, tsxResult.stdout);
        logger.success(`DBML: ${dbmlPath}`);
        return dbmlPath;
    }
    logger.warn(t("commands.schema.dbmlGenerateFailed", { stderr: tsxResult.stderr }));
    logger.info(t("commands.schema.tsxHint"));
    logger.info(t("commands.schema.tsxInstallHint"));
    return null;
}
/**
 * SVG ER 図を生成
 */
async function generateSvg(projectPath, dbmlPath, outputDir, packageStatus, logger, verbose) {
    const svgPath = resolve(outputDir, "schema.svg");
    // 方法1: @softwaretechnik/dbml-renderer を使用
    if (packageStatus.dbmlRenderer) {
        logger.debug(`実行: npx dbml-renderer -i "${dbmlPath}" -o "${svgPath}"`);
        const rendererResult = await spawnAsync("npx", ["dbml-renderer", "-i", dbmlPath, "-o", svgPath], {
            cwd: projectPath,
            stdio: verbose ? "inherit" : "pipe",
        });
        if (rendererResult.exitCode === 0 && fileExists(svgPath)) {
            logger.success(`SVG ER 図: ${svgPath}`);
            return;
        }
        logger.debug(`dbml-renderer 失敗: ${rendererResult.stderr}`);
    }
    // 方法2: dbml-cli + graphviz を使用
    // まず dbml を dot 形式に変換
    const dotPath = resolve(outputDir, "schema.dot");
    // @dbml/cli がインストールされているか確認
    if (isPackageInstalled(projectPath, "@dbml/cli")) {
        // dbml を dot に変換
        logger.debug(`実行: npx dbml2dot "${dbmlPath}" -o "${dotPath}"`);
        const toDotResult = await spawnAsync("npx", ["dbml2dot", dbmlPath, "-o", dotPath], {
            cwd: projectPath,
            stdio: verbose ? "inherit" : "pipe",
        });
        // dot を svg に変換
        if (toDotResult.exitCode === 0 && fileExists(dotPath)) {
            logger.debug(`実行: dot -Tsvg "${dotPath}" -o "${svgPath}"`);
            const toSvgResult = await spawnAsync("dot", ["-Tsvg", dotPath, "-o", svgPath], {
                cwd: projectPath,
                stdio: verbose ? "inherit" : "pipe",
            });
            if (toSvgResult.exitCode === 0 && fileExists(svgPath)) {
                logger.success(`SVG ER 図: ${svgPath}`);
                // dot ファイル削除
                rmSync(dotPath, { force: true });
                return;
            }
        }
    }
    else {
        logger.debug("@dbml/cli 未インストールまたは変換失敗");
    }
    // 方法3: 簡易 SVG 生成 (フォールバック)
    logger.warn(t("commands.schema.svgToolUnavailable"));
    logger.info(t("commands.schema.svgInstallOptions"));
    logger.info(t("commands.schema.svgOption1"));
    logger.info(t("commands.schema.svgOption2"));
    logger.info("");
    logger.info(t("commands.schema.svgAlternative"));
    logger.info(t("commands.schema.svgAltDbdiagram"));
    logger.info(t("commands.schema.svgAltDbdocs"));
}
/**
 * スキーマファイルのインデックスとドキュメントを生成
 *
 * @param schemaSource スキーマソースディレクトリ
 * @param outputDir 出力ディレクトリ
 * @param dbmlPath DBMLファイルパス（なければnull）
 * @param logger ロガー
 * @param dbName データベース名
 * @returns ポータル用テーブル情報
 */
function generateSchemaIndex(schemaSource, outputDir, dbmlPath, logger, _dbName = "default") {
    const schemaFiles = listFiles(schemaSource, {
        extensions: [".ts"],
        recursive: false,
    }).filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".spec.ts"));
    if (schemaFiles.length === 0) {
        logger.warn(t("commands.schema.schemaFilesNotFound"));
        return undefined;
    }
    // DBML からテーブル情報を抽出、なければ直接パース
    let tables = [];
    let drizzleResult = null;
    if (dbmlPath) {
        tables = parseDbmlTables(dbmlPath, logger);
    }
    // DBML がない場合、または DBML からテーブルが抽出できなかった場合は直接パース
    if (tables.length === 0) {
        logger.info(t("commands.schema.directParsing"));
        drizzleResult = parseDrizzleSchemaDir(schemaSource, logger);
        // DrizzleSchemaResult を TableInfo[] に変換
        tables = drizzleResult.tables.map((t) => ({
            name: t.name,
            note: t.description,
            columns: t.columns.map((c) => ({
                name: c.name,
                type: c.type,
                pk: c.primaryKey,
                notNull: !c.nullable,
                unique: c.unique,
                default: c.default,
                note: c.description,
            })),
            indexes: t.indexes.map((i) => ({
                name: i.name,
                columns: i.columns,
                unique: i.unique,
            })),
        }));
        logger.success(`${tables.length} テーブルを直接パースで抽出`);
    }
    // スキーマドキュメント Markdown 生成
    const content = [
        "# データベーススキーマ",
        "",
        `> 自動生成: ${new Date().toISOString().split("T")[0]}`,
        "",
        "## 概要",
        "",
        `- スキーマファイル数: ${schemaFiles.length}`,
        `- テーブル数: ${tables.length}`,
        "",
        "## スキーマファイル",
        "",
        "| ファイル | 説明 |",
        "|----------|------|",
        ...schemaFiles.map((file) => {
            const name = basename(file);
            const description = inferFileDescription(name);
            return `| \`${name}\` | ${description} |`;
        }),
        "",
    ];
    // テーブル一覧
    if (tables.length > 0) {
        content.push("## テーブル一覧", "", "| テーブル名 | カラム数 | 説明 |", "|------------|----------|------|", ...tables.map((t) => `| \`${t.name}\` | ${t.columns.length} | ${t.note || "-"} |`), "");
        // 各テーブルの詳細
        content.push("## テーブル詳細", "");
        for (const table of tables) {
            content.push(`### ${table.name}`, "", table.note ? `${table.note}` : "", "", "| カラム | 型 | 制約 | 説明 |", "|--------|-----|------|------|", ...table.columns.map((col) => {
                const constraints = [];
                if (col.pk)
                    constraints.push("PK");
                if (col.notNull)
                    constraints.push("NOT NULL");
                if (col.unique)
                    constraints.push("UNIQUE");
                if (col.default)
                    constraints.push(`DEFAULT: ${col.default}`);
                return `| \`${col.name}\` | ${col.type} | ${constraints.join(", ") || "-"} | ${col.note || "-"} |`;
            }), "");
            // インデックス
            if (table.indexes && table.indexes.length > 0) {
                content.push("**インデックス:**", "", ...table.indexes.map((idx) => `- \`${idx.name}\`: ${idx.columns.join(", ")}${idx.unique ? " (UNIQUE)" : ""}`), "");
            }
        }
    }
    // 可視化セクション
    content.push("## 可視化", "", "### ローカルファイル", "", dbmlPath ? "- [DBML ソース](./schema.dbml)" : "- DBML: 生成されていません", fileExists(resolve(outputDir, "schema.svg"))
        ? "- [ER 図 (SVG)](./schema.svg)"
        : "- SVG: 生成されていません", "", "### オンラインツール", "", "- [dbdiagram.io](https://dbdiagram.io/d) - DBML をコピーして可視化", "- [dbdocs.io](https://dbdocs.io/) - DBML ドキュメントホスティング", "", "## 生成コマンド", "", "```bash", "shirokuma-flow schema", "```", "");
    const docsPath = resolve(outputDir, "schema-docs.md");
    writeFile(docsPath, content.join("\n"));
    logger.success(`スキーマドキュメント: ${docsPath}`);
    // ポータル用 JSON 出力
    let portalSchema;
    if (drizzleResult) {
        // 直接パース結果を使用（より正確）
        portalSchema = toPortalDbSchema(drizzleResult);
    }
    else {
        // DBML から生成
        portalSchema = generatePortalDbSchema(tables, schemaFiles, schemaSource, logger);
    }
    // 各DBディレクトリにJSONを出力（参照用）
    const dbJsonPath = resolve(outputDir, "db-schema.json");
    writeFile(dbJsonPath, JSON.stringify(portalSchema, null, 2));
    logger.debug(`DB固有JSON: ${dbJsonPath}`);
    // テーブル情報を返す
    return portalSchema.tables;
}
/**
 * ファイル名から説明を推測
 */
function inferFileDescription(filename) {
    const name = filename.replace(/\.ts$/, "");
    const descriptions = {
        index: "エクスポートインデックス",
        auth: "認証関連テーブル (users, sessions, accounts)",
        users: "ユーザーテーブル",
        sessions: "セッションテーブル",
        accounts: "アカウント連携テーブル",
        posts: "投稿テーブル",
        content: "コンテンツ関連テーブル",
        categories: "カテゴリテーブル",
        tags: "タグテーブル",
        comments: "コメントテーブル",
        organizations: "組織テーブル",
        projects: "プロジェクトテーブル",
        members: "メンバーテーブル",
        permissions: "権限テーブル",
        settings: "設定テーブル",
        relations: "リレーション定義",
    };
    return descriptions[name] || "-";
}
function parseDbmlTables(dbmlPath, logger) {
    const content = readFile(dbmlPath);
    if (!content) {
        return [];
    }
    const tables = [];
    // DBML パース (簡易実装)
    // drizzle-dbml-generator の出力形式: table table_name { ... }
    // Table "table_name" { ... } 形式も対応
    // 改善: マルチラインマッチングでテーブル全体を抽出
    const tableBlocks = content.split(/\n(?=table\s+\w+\s*\{)/i);
    for (const block of tableBlocks) {
        // table table_name { から始まるブロックを解析
        const headerMatch = block.match(/^table\s+(\w+)\s*(?:\[([^\]]*)\])?\s*\{/i);
        if (!headerMatch)
            continue;
        const tableName = headerMatch[1];
        const tableOptions = headerMatch[2] || "";
        const table = {
            name: tableName,
            columns: [],
            indexes: [],
        };
        // テーブルノート抽出
        const noteMatch = tableOptions.match(/note:\s*'([^']+)'/);
        if (noteMatch) {
            table.note = noteMatch[1];
        }
        // カラム解析
        const lines = block.split("\n").slice(1).map((l) => l.trim()).filter((l) => l);
        let inIndexes = false;
        for (const line of lines) {
            // インデックスセクション開始
            if (line.startsWith("indexes")) {
                inIndexes = true;
                continue;
            }
            // セクション終了
            if (line === "}" && inIndexes) {
                inIndexes = false;
                continue;
            }
            // コメント・空行・閉じ括弧をスキップ
            if (line.startsWith("//") || line === "{" || line === "}") {
                continue;
            }
            // インデックス行の解析
            if (inIndexes) {
                // (columns) [options] 形式
                const idxMatch = line.match(/\(([^)]+)\)\s*(?:\[([^\]]*)\])?/);
                if (idxMatch) {
                    const columns = idxMatch[1].split(",").map((c) => c.trim().replace(/"/g, ""));
                    const options = idxMatch[2] || "";
                    const nameMatch = options.match(/name:\s*'([^']+)'/);
                    table.indexes.push({
                        name: nameMatch ? nameMatch[1] : columns.join("_"),
                        columns,
                        unique: options.includes("unique"),
                    });
                }
                continue;
            }
            // カラム行: column_name type [options] または column_name "type with spaces" [options]
            const colMatch = line.match(/^(\w+)\s+(?:"([^"]+)"|(\w+(?:\([^)]+\))?))\s*(?:\[([^\]]*)\])?/);
            if (colMatch) {
                // 型は引用符付き (colMatch[2]) または通常 (colMatch[3])
                const columnType = colMatch[2] || colMatch[3] || "unknown";
                const column = {
                    name: colMatch[1],
                    type: columnType,
                };
                // オプションは4番目のグループ
                const options = colMatch[4] || "";
                if (options.includes("pk"))
                    column.pk = true;
                if (options.includes("not null"))
                    column.notNull = true;
                if (options.includes("unique") && !options.includes("unique]"))
                    column.unique = true;
                const defaultMatch = options.match(/default:\s*`([^`]+)`/);
                if (defaultMatch) {
                    column.default = defaultMatch[1];
                }
                const noteMatch = options.match(/note:\s*'([^']+)'/);
                if (noteMatch) {
                    column.note = noteMatch[1];
                }
                table.columns.push(column);
            }
        }
        tables.push(table);
    }
    logger.debug(`${tables.length} テーブルを抽出`);
    return tables;
}
/**
 * スキーマファイルからJSDocコメントを抽出（共通パーサー使用）
 */
function extractJsDocFromSchemaFiles(schemaFiles, logger) {
    // 全ファイルの内容を結合してパース
    const mergedResult = {
        tables: new Map(),
        columns: new Map(),
        indexes: new Map(),
        parsed: new Map(),
    };
    for (const file of schemaFiles) {
        const content = readFile(file);
        if (!content)
            continue;
        // 共通パーサーでJSDoc抽出
        const fileResult = extractDbSchemaJsDocs(content);
        // 結果をマージ
        for (const [tableName, desc] of fileResult.tables) {
            mergedResult.tables.set(tableName, desc);
        }
        for (const [tableName, columnMap] of fileResult.columns) {
            mergedResult.columns.set(tableName, columnMap);
        }
        for (const [tableName, indexMap] of fileResult.indexes) {
            mergedResult.indexes.set(tableName, indexMap);
        }
        for (const [tableName, parsed] of fileResult.parsed) {
            mergedResult.parsed.set(tableName, parsed);
        }
    }
    const indexCount = Array.from(mergedResult.indexes.values()).reduce((sum, m) => sum + m.size, 0);
    logger.debug(`JSDoc抽出: ${mergedResult.tables.size} テーブル, ` +
        `${Array.from(mergedResult.columns.values()).reduce((sum, m) => sum + m.size, 0)} カラム, ` +
        `${indexCount} インデックス`);
    return mergedResult;
}
function generatePortalDbSchema(tables, schemaFiles, schemaSource, logger) {
    // JSDocコメントを抽出
    const jsDocInfo = extractJsDocFromSchemaFiles(schemaFiles, logger);
    // ファイル名からカテゴリを推論
    const fileCategories = {};
    for (const file of schemaFiles) {
        const fileName = basename(file).replace(/\.ts$/, "");
        fileCategories[fileName] = inferCategoryFromFileName(fileName);
    }
    // テーブル情報を変換
    const portalTables = tables.map((table) => {
        // テーブル名からファイルを推測
        const possibleFile = guessSchemaFile(table.name, schemaFiles);
        const fileName = possibleFile ? basename(possibleFile).replace(/\.ts$/, "") : undefined;
        const category = fileName ? fileCategories[fileName] : inferCategoryFromTableName(table.name);
        // JSDocからテーブル説明を取得
        const tableDescription = jsDocInfo.tables.get(table.name) || table.note;
        // カラムのJSDocマップ
        const columnJsDocs = jsDocInfo.columns.get(table.name);
        // インデックスのJSDocマップ
        const indexJsDocs = jsDocInfo.indexes.get(table.name);
        // 外部キー情報を抽出（コメントやnoteから推測）
        const foreignKeys = [];
        for (const col of table.columns) {
            if (col.name.endsWith("_id") || col.name.endsWith("Id")) {
                // user_id -> users, project_id -> projects など
                const refTableName = guessReferencedTable(col.name);
                if (refTableName) {
                    foreignKeys.push({
                        column: col.name,
                        references: {
                            table: refTableName,
                            column: "id",
                        },
                    });
                }
            }
        }
        return {
            name: table.name,
            file: possibleFile ? basename(possibleFile) : undefined,
            description: tableDescription,
            category,
            columnCount: table.columns.length,
            columns: table.columns.map((col) => ({
                name: col.name,
                type: col.type,
                primaryKey: col.pk,
                nullable: !col.notNull && !col.pk,
                unique: col.unique,
                default: col.default,
                description: columnJsDocs?.get(col.name) || col.note,
            })),
            foreignKeys: foreignKeys.length > 0 ? foreignKeys : undefined,
            indexes: table.indexes?.map((idx) => ({
                name: idx.name,
                columns: idx.columns,
                unique: idx.unique,
                description: indexJsDocs?.get(idx.name),
            })),
        };
    });
    return {
        tables: portalTables,
        generatedAt: new Date().toISOString(),
    };
}
/**
 * ファイル名からカテゴリを推論
 */
function inferCategoryFromFileName(fileName) {
    const categoryMap = {
        auth: "Authentication",
        users: "Authentication",
        sessions: "Authentication",
        accounts: "Authentication",
        verifications: "Authentication",
        organizations: "Organizations",
        projects: "Projects",
        entities: "Content",
        relations: "Content",
        comments: "Content",
        posts: "Content",
        categories: "Content",
        tags: "Content",
        activities: "Activities",
        permissions: "Permissions",
        tokens: "Tokens",
        context: "User Context",
        settings: "Settings",
        audit: "Audit",
    };
    // 複数形/単数形の両方をチェック
    const singular = fileName.replace(/s$/, "");
    return categoryMap[fileName] || categoryMap[singular] || "Other";
}
/**
 * テーブル名からカテゴリを推論
 */
function inferCategoryFromTableName(tableName) {
    const name = tableName.toLowerCase();
    // Authentication
    if (name.includes("user") || name === "sessions" || name === "session" || name.includes("account") || name.includes("verification") || name.includes("rate_limit")) {
        return "Authentication";
    }
    // Organizations
    if (name.includes("organization") || name.includes("org_")) {
        return "Organizations";
    }
    // Projects
    if (name.includes("project") || name.includes("team")) {
        return "Projects";
    }
    // Work Sessions (DevMemory specific)
    if (name.includes("work_session") || name.includes("session_") || name.includes("pause")) {
        return "Work Sessions";
    }
    // Content (Blog CMS + DevMemory)
    if (name.includes("post") ||
        name.includes("category") ||
        name.includes("categories") ||
        name.includes("tag") ||
        name.includes("comment") ||
        name.includes("entity") ||
        name.includes("entities") ||
        name.includes("relation") ||
        name.includes("faq") ||
        name.includes("feedback")) {
        return "Content";
    }
    // Activities
    if (name.includes("activity") || name.includes("activities")) {
        return "Activities";
    }
    // MCP Tokens
    if (name.includes("token") || name.includes("mcp_")) {
        return "MCP Tokens";
    }
    // Permissions
    if (name.includes("permission") || name.includes("member")) {
        return "Permissions";
    }
    // User Context
    if (name.includes("context")) {
        return "User Context";
    }
    // Audit
    if (name.includes("audit") || name.includes("log")) {
        return "Audit";
    }
    return "Other";
}
/**
 * テーブル名からスキーマファイルを推測
 */
function guessSchemaFile(tableName, schemaFiles) {
    const name = tableName.toLowerCase();
    for (const file of schemaFiles) {
        const fileName = basename(file).replace(/\.ts$/, "").toLowerCase();
        // 完全一致
        if (name === fileName || name === fileName + "s" || name + "s" === fileName) {
            return file;
        }
        // 部分一致
        if (name.includes(fileName) || fileName.includes(name.replace(/_/g, ""))) {
            return file;
        }
    }
    // 特殊なマッピング
    const specialMappings = {
        auth: ["users", "sessions", "accounts", "verifications", "rate_limit"],
        organizations: ["organizations", "organization_members"],
        projects: ["projects", "team_members", "project_sequences", "project_members"],
        sessions: ["work_sessions", "session_pause_events", "session_entities", "session_notes"],
        entities: ["entities", "relations"],
    };
    for (const [fileName, tables] of Object.entries(specialMappings)) {
        if (tables.includes(name)) {
            const matchingFile = schemaFiles.find((f) => basename(f).replace(/\.ts$/, "").toLowerCase() === fileName);
            if (matchingFile)
                return matchingFile;
        }
    }
    return undefined;
}
/**
 * カラム名から参照先テーブルを推測
 */
function guessReferencedTable(columnName) {
    // user_id -> users, project_id -> projects, etc.
    const match = columnName.match(/^(.+?)_?[iI]d$/);
    if (match) {
        const baseName = match[1].toLowerCase().replace(/_/g, "");
        // 特殊なマッピング
        const specialMappings = {
            // Authentication
            user: "users",
            author: "users", // posts.author_id -> users
            // Organizations
            organization: "organizations",
            org: "organizations",
            // Projects
            project: "projects",
            // Work Sessions
            session: "work_sessions",
            worksession: "work_sessions",
            // Content
            entity: "entities",
            category: "categories", // irregular plural: -y -> -ies
            activity: "activities",
            relatedpost: "posts", // self-reference
            // 無視するカラム
            parent: undefined,
            source: undefined,
            target: undefined,
        };
        if (baseName in specialMappings) {
            return specialMappings[baseName] || undefined;
        }
        // デフォルト: 複数形にする
        return baseName + "s";
    }
    return undefined;
}
//# sourceMappingURL=schema.js.map