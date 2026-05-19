/**
 * Drizzle ORM スキーマパーサー
 *
 * TypeScript スキーマファイルを直接パースしてテーブル情報を抽出。
 * drizzle-dbml-generator が利用できない場合のフォールバック。
 *
 * @module parsers/drizzle-schema
 */
import { basename } from "node:path";
import { readFile, listFiles } from "../utils/file.js";
import { createLogger } from "../utils/logger.js";
import { findMatchingBrace } from "@shirokuma-library/lint/brace-matching";
import { camelToSnake } from "../utils/string-transforms.js";
// =============================================================================
// メインパーサー
// =============================================================================
/**
 * スキーマディレクトリからすべてのテーブルを抽出
 */
export function parseDrizzleSchemaDir(schemaDir, logger) {
    const log = logger || createLogger(false);
    const schemaFiles = listFiles(schemaDir, {
        extensions: [".ts"],
        recursive: false,
    }).filter((f) => !f.endsWith(".test.ts") &&
        !f.endsWith(".spec.ts") &&
        !basename(f).startsWith("index"));
    log.debug(`スキーマファイル: ${schemaFiles.length} 件`);
    const allTables = [];
    for (const file of schemaFiles) {
        const content = readFile(file);
        if (!content)
            continue;
        const tables = parseDrizzleSchema(content, file, log);
        allTables.push(...tables);
    }
    log.debug(`抽出テーブル: ${allTables.length} 件`);
    return {
        tables: allTables,
        generatedAt: new Date().toISOString(),
    };
}
/**
 * 単一スキーマファイルからテーブルを抽出
 */
export function parseDrizzleSchema(sourceCode, filePath, logger) {
    const log = logger || createLogger(false);
    const tables = [];
    const fileName = basename(filePath);
    // プリスキャン: variableName → tableName のマッピングを構築（前方参照対応）
    const tableMap = new Map();
    const prescanRegex = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*["'](\w+)["']/g;
    let prescanMatch;
    while ((prescanMatch = prescanRegex.exec(sourceCode)) !== null) {
        tableMap.set(prescanMatch[1], prescanMatch[2]);
    }
    // pgTable 定義を検出
    // パターン: export const varName = pgTable("table_name", { ... }, (table) => [...])
    const pgTableRegex = /(?:\/\*\*[\s\S]*?\*\/\s*)?export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*["'](\w+)["']\s*,\s*\{/g;
    let match;
    while ((match = pgTableRegex.exec(sourceCode)) !== null) {
        const variableName = match[1];
        const tableName = match[2];
        const defStart = match.index;
        // JSDoc コメントを抽出
        const jsDoc = extractJsDocBefore(sourceCode, defStart);
        const description = extractDescriptionFromJsDoc(jsDoc);
        // テーブル定義の本体を抽出
        const tableBody = extractTableBody(sourceCode, match.index + match[0].length - 1);
        if (!tableBody) {
            log.debug(`テーブル本体を抽出できません: ${tableName}`);
            continue;
        }
        // カラムを抽出
        const columns = extractColumns(tableBody.columnsBody, sourceCode, defStart);
        // インデックスを抽出
        const indexes = extractIndexes(tableBody.indexesBody);
        // 外部キーを抽出（カラムの references から）
        const foreignKeys = extractForeignKeys(tableBody.columnsBody, sourceCode, defStart, tableMap);
        tables.push({
            name: tableName,
            variableName,
            file: fileName,
            description,
            category: inferCategoryFromFile(fileName),
            columns,
            foreignKeys,
            indexes,
        });
        log.debug(`テーブル抽出: ${tableName} (${columns.length} カラム, ${foreignKeys.length} FK, ${indexes.length} インデックス)`);
    }
    return tables;
}
// =============================================================================
// 内部ヘルパー関数
// =============================================================================
/**
 * pgTable の本体を抽出（カラム定義とインデックス定義）
 */
function extractTableBody(sourceCode, startIndex) {
    // { から開始して対応する } を見つける（文字列・コメント考慮）
    const columnsEnd = findMatchingBrace(sourceCode, startIndex);
    if (columnsEnd === null)
        return null;
    const columnsBody = sourceCode.substring(startIndex + 1, columnsEnd);
    // インデックス定義部分を抽出 }, (table) => [...])
    let indexesBody = "";
    const afterColumns = sourceCode.substring(columnsEnd);
    const indexMatch = afterColumns.match(/^\s*\}\s*,\s*\(\s*\w*\s*\)\s*=>\s*\(\s*\{([\s\S]*?)\}\s*\)/);
    if (indexMatch) {
        indexesBody = indexMatch[1];
    }
    else {
        // 別の形式: }, (table) => [...])
        const altIndexMatch = afterColumns.match(/^\s*\}\s*,\s*\(\s*\w*\s*\)\s*=>\s*\[([\s\S]*?)\]\s*\)/);
        if (altIndexMatch) {
            indexesBody = altIndexMatch[1];
        }
    }
    return { columnsBody, indexesBody };
}
/**
 * カラム定義を抽出
 */
function extractColumns(columnsBody, _fullSource, _tableStart) {
    const columns = [];
    // カラム定義パターン:
    // columnName: type('sql_name').constraint1().constraint2()...
    // /** comment */ columnName: type('sql_name')
    const columnRegex = /(?:\/\*\*\s*([\s\S]*?)\s*\*\/\s*)?(\w+)\s*:\s*(\w+)\s*\(\s*["'](\w+)["']/g;
    let match;
    while ((match = columnRegex.exec(columnsBody)) !== null) {
        const jsDocComment = match[1];
        const variableName = match[2];
        const drizzleType = match[3];
        const sqlName = match[4];
        // 残りの定義を抽出（次の行または , まで）
        const afterMatch = columnsBody.substring(match.index + match[0].length);
        const restMatch = afterMatch.match(/^[^,\n]*/);
        const restDef = restMatch ? restMatch[0] : "";
        // 型を推論
        const type = mapDrizzleTypeToSql(drizzleType, restDef);
        // 制約を解析
        const isPrimaryKey = restDef.includes("primaryKey()") || restDef.includes(".primaryKey()");
        const isNotNull = restDef.includes("notNull()") || restDef.includes(".notNull()");
        const isUnique = restDef.includes("unique()") || restDef.includes(".unique()");
        // デフォルト値を抽出
        const defaultMatch = restDef.match(/default(?:Now)?\s*\(\s*([^)]*)\s*\)/);
        const defaultValue = defaultMatch ? defaultMatch[1].trim() || "now()" : undefined;
        // JSDocから説明を抽出
        const description = jsDocComment
            ? jsDocComment.replace(/\s*\n\s*\*?\s*/g, " ").trim()
            : undefined;
        columns.push({
            name: sqlName,
            variableName,
            type,
            primaryKey: isPrimaryKey,
            nullable: !isNotNull && !isPrimaryKey,
            unique: isUnique,
            default: defaultValue,
            description,
        });
    }
    // スプレッド構文で追加されるカラムを検出 (...timestamps)
    if (columnsBody.includes("...timestamps")) {
        columns.push({ name: "created_at", variableName: "createdAt", type: "timestamp", nullable: false }, { name: "updated_at", variableName: "updatedAt", type: "timestamp", nullable: false });
    }
    if (columnsBody.includes("...authTimestamps")) {
        columns.push({ name: "created_at", variableName: "createdAt", type: "timestamp", nullable: false }, { name: "updated_at", variableName: "updatedAt", type: "timestamp", nullable: false });
    }
    return columns;
}
/**
 * 外部キーを抽出
 */
function extractForeignKeys(columnsBody, fullSource, tableStart, tableMap) {
    const foreignKeys = [];
    // references(() => table.column) パターンを検出
    // 例: .references(() => users.id, { onDelete: 'cascade' })
    const refRegex = /(\w+)\s*:\s*\w+\s*\(\s*["'](\w+)["'][^)]*\)(?:[^.]*)?\.references\s*\(\s*\(\s*\)\s*=>\s*(\w+)\.(\w+)/g;
    let match;
    while ((match = refRegex.exec(columnsBody)) !== null) {
        const columnName = match[2]; // SQL カラム名
        const refTable = match[3]; // 参照テーブル変数名
        const refColumn = match[4]; // 参照カラム名（JS プロパティ名）
        // onDelete オプションを抽出
        const afterRef = columnsBody.substring(match.index + match[0].length, match.index + match[0].length + 100);
        const onDeleteMatch = afterRef.match(/onDelete\s*:\s*["'](\w+)["']/);
        foreignKeys.push({
            column: columnName,
            references: {
                table: tableMap.get(refTable) ?? refTable,
                column: camelToSnake(refColumn),
            },
            onDelete: onDeleteMatch ? onDeleteMatch[1] : undefined,
        });
    }
    return foreignKeys;
}
/**
 * インデックス定義を抽出
 */
function extractIndexes(indexesBody) {
    const indexes = [];
    if (!indexesBody.trim())
        return indexes;
    // インデックス定義パターン:
    // index("name").on(table.col1, table.col2)
    // uniqueIndex("name").on(table.col)
    const indexRegex = /(uniqueIndex|index)\s*\(\s*["']([^"']+)["']\s*\)\s*\.on\s*\(([^)]+)\)/g;
    let match;
    while ((match = indexRegex.exec(indexesBody)) !== null) {
        const isUnique = match[1] === "uniqueIndex";
        const name = match[2];
        const columnsStr = match[3];
        // table.col1, table.col2 -> [col1, col2]
        const columns = columnsStr
            .split(",")
            .map((c) => {
            const colMatch = c.trim().match(/\w+\.(\w+)/);
            return colMatch ? camelToSnake(colMatch[1]) : "";
        })
            .filter((c) => c);
        indexes.push({
            name,
            columns,
            unique: isUnique,
        });
    }
    return indexes;
}
/**
 * 定義の直前にある JSDoc を抽出
 */
function extractJsDocBefore(sourceCode, defStart) {
    const beforeDef = sourceCode.substring(0, defStart);
    const jsDocEnd = beforeDef.lastIndexOf("*/");
    if (jsDocEnd === -1)
        return "";
    // */ と定義の間に他のコードがないか確認
    const between = beforeDef.substring(jsDocEnd + 2);
    if (!/^\s*$/.test(between))
        return "";
    const jsDocStart = beforeDef.lastIndexOf("/**");
    if (jsDocStart === -1 || jsDocStart > jsDocEnd)
        return "";
    return beforeDef.substring(jsDocStart, jsDocEnd + 2);
}
/**
 * JSDoc から説明文を抽出
 */
function extractDescriptionFromJsDoc(jsDoc) {
    if (!jsDoc)
        return undefined;
    // /** と */ を除去して行に分割
    const lines = jsDoc
        .replace(/^\/\*\*\s*/, "")
        .replace(/\s*\*\/$/, "")
        .split("\n")
        .map((l) => l.replace(/^\s*\*\s?/, "").trim())
        .filter((l) => !l.startsWith("@"));
    const description = lines.join(" ").trim();
    return description || undefined;
}
/**
 * Drizzle 型を SQL 型にマッピング
 */
function mapDrizzleTypeToSql(drizzleType, _restDef) {
    const typeMap = {
        uuid: "uuid",
        text: "text",
        varchar: "varchar",
        char: "char",
        integer: "integer",
        smallint: "smallint",
        bigint: "bigint",
        serial: "serial",
        smallserial: "smallserial",
        bigserial: "bigserial",
        boolean: "boolean",
        timestamp: "timestamp",
        date: "date",
        time: "time",
        interval: "interval",
        numeric: "numeric",
        decimal: "decimal",
        real: "real",
        doublePrecision: "double precision",
        json: "json",
        jsonb: "jsonb",
        bytea: "bytea",
        inet: "inet",
        cidr: "cidr",
        macaddr: "macaddr",
    };
    return typeMap[drizzleType] || drizzleType;
}
/**
 * ファイル名からカテゴリを推論
 */
function inferCategoryFromFile(fileName) {
    const name = fileName.replace(/\.ts$/, "").toLowerCase();
    const categoryMap = {
        auth: "authentication",
        users: "authentication",
        sessions: "authentication",
        accounts: "authentication",
        verification: "authentication",
        content: "content",
        posts: "content",
        categories: "content",
        tags: "content",
        comments: "content",
        organizations: "organizations",
        projects: "projects",
        entities: "entities",
        relations: "relations",
        activities: "activities",
        tokens: "tokens",
        common: "common",
        audit: "audit",
    };
    return categoryMap[name] || "other";
}
/**
 * DrizzleSchemaResult を Portal 用 JSON に変換
 */
export function toPortalDbSchema(result) {
    return {
        tables: result.tables.map((table) => ({
            name: table.name,
            file: table.file,
            description: table.description,
            category: table.category,
            columnCount: table.columns.length,
            columns: table.columns.map((col) => ({
                name: col.name,
                type: col.type,
                primaryKey: col.primaryKey,
                nullable: col.nullable,
                unique: col.unique,
                default: col.default,
                description: col.description,
            })),
            foreignKeys: table.foreignKeys.length > 0
                ? table.foreignKeys.map((fk) => ({
                    column: fk.column,
                    references: fk.references,
                }))
                : undefined,
            indexes: table.indexes.length > 0
                ? table.indexes.map((idx) => ({
                    name: idx.name,
                    columns: idx.columns,
                    unique: idx.unique,
                }))
                : undefined,
        })),
        generatedAt: result.generatedAt,
    };
}
//# sourceMappingURL=drizzle-schema.js.map