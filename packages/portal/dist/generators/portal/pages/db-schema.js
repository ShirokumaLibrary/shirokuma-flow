/**
 * DB スキーマページジェネレーター
 */
import { renderTemplate } from "../renderer.js";
import { getCategoryConfig, normalizeCategory, inferCategory } from "../db-schema-utils.js";
/** JSON.stringify の結果を HTML inline script に安全に埋め込む */
function safeJsonForHtml(data) {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}
/**
 * DB スキーマ一覧ページの HTML を生成する
 */
export function generateDbSchemaPage(data) {
    if (!data.dbSchema) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: "DB スキーマ",
            message: "db-schema.json が見つかりません。",
        });
    }
    const { dbSchema } = data;
    const databases = dbSchema.databases || [
        { name: "database", tableCount: dbSchema.tables.length },
    ];
    // カテゴリでグループ化されたテーブル一覧
    const tablesByCategory = groupTablesByCategory(dbSchema.tables);
    return renderTemplate("pages/db-schema.html.hbs", {
        projectName: data.projectName,
        databases,
        multipleDb: databases.length > 1,
        tablesByCategory,
        totalTables: dbSchema.tables.length,
        generatedAt: dbSchema.generatedAt,
    });
}
/**
 * 特定 DB のスキーマページを生成する
 */
export function generateDbSchemaDbPage(data, dbName) {
    if (!data.dbSchema) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: "DB スキーマ",
            message: "db-schema.json が見つかりません。",
        });
    }
    const tables = data.dbSchema.databases
        ? data.dbSchema.tables.filter((t) => t.database === dbName)
        : data.dbSchema.tables;
    const dbInfo = data.dbSchema.databases?.find((db) => db.name === dbName);
    const tablesByCategory = groupTablesByCategory(tables);
    return renderTemplate("pages/db-schema-db.html.hbs", {
        projectName: data.projectName,
        dbName,
        dbInfo,
        tablesByCategory,
        totalTables: tables.length,
    });
}
/**
 * テーブル詳細ページを生成する
 */
export function generateDbSchemaTablePage(data, tableName) {
    if (!data.dbSchema) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: "テーブル詳細",
            message: "db-schema.json が見つかりません。",
        });
    }
    const decodedName = decodeURIComponent(tableName);
    const table = data.dbSchema.tables.find((t) => t.name === decodedName || t.name === tableName);
    if (!table) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: "テーブル詳細",
            message: `テーブル「${decodedName}」が見つかりません。`,
        });
    }
    const category = normalizeCategory(table.category) || inferCategory(table.name);
    const categoryConfig = getCategoryConfig(category);
    // 参照先テーブル一覧
    const referencedTables = [
        ...new Set(table.foreignKeys?.map((fk) => fk.references.table) || []),
    ];
    // このテーブルを参照しているテーブル一覧
    const referencingTables = data.dbSchema.tables
        .filter((t) => t.foreignKeys?.some((fk) => fk.references.table === table.name))
        .map((t) => t.name);
    return renderTemplate("pages/db-schema-table.html.hbs", {
        projectName: data.projectName,
        table,
        category,
        categoryConfig,
        referencedTables,
        referencingTables,
        hasColumns: (table.columns?.length || 0) > 0,
        hasIndexes: (table.indexes?.length || 0) > 0,
        hasForeignKeys: (table.foreignKeys?.length || 0) > 0,
    });
}
/**
 * DB ER 図ページを生成する
 */
export function generateDbDiagramPage(data, dbName) {
    if (!data.dbSchema) {
        return renderTemplate("pages/empty-state.html.hbs", {
            title: "ER 図",
            message: "db-schema.json が見つかりません。",
        });
    }
    const tables = dbName
        ? data.dbSchema.tables.filter((t) => t.database === dbName)
        : data.dbSchema.tables;
    // Cytoscape.js 用のノード・エッジデータを生成
    const nodes = tables.map((t) => ({
        id: t.name,
        label: t.name,
        category: normalizeCategory(t.category) || inferCategory(t.name),
        columnCount: t.columns?.length || 0,
        columns: (t.columns || []).slice(0, 8), // 最大 8 列を表示
    }));
    const edges = [];
    for (const table of tables) {
        for (const fk of table.foreignKeys || []) {
            edges.push({
                source: table.name,
                target: fk.references.table,
                label: `${fk.column} → ${fk.references.column}`,
            });
        }
    }
    // Mermaid ER 図を生成（シンプル版フォールバック）
    const mermaidChart = generateMermaidEr(tables);
    return renderTemplate("pages/db-diagram.html.hbs", {
        projectName: data.projectName,
        dbName: dbName || "database",
        nodesJson: safeJsonForHtml(nodes),
        edgesJson: safeJsonForHtml(edges),
        mermaidChart,
        tableCount: tables.length,
        edgeCount: edges.length,
    });
}
function groupTablesByCategory(tables) {
    const groups = new Map();
    for (const table of tables) {
        const category = normalizeCategory(table.category) || inferCategory(table.name);
        if (!groups.has(category)) {
            groups.set(category, []);
        }
        groups.get(category).push(table);
    }
    return Array.from(groups.entries()).map(([category, tbls]) => {
        const config = getCategoryConfig(category);
        return {
            category,
            label: config.label,
            colorClass: config.color,
            bgColorClass: config.bgColor,
            tables: tbls,
        };
    });
}
function generateMermaidEr(tables) {
    const lines = ["erDiagram"];
    for (const table of tables.slice(0, 20)) {
        // テーブル定義
        if (table.columns && table.columns.length > 0) {
            const safeTableName = table.name.replace(/[^a-zA-Z0-9_]/g, "_");
            lines.push(`  ${safeTableName} {`);
            for (const col of table.columns.slice(0, 10)) {
                const pkMark = col.primaryKey ? " PK" : "";
                const safeType = col.type.replace(/[^a-zA-Z0-9_]/g, "_");
                const safeName = col.name.replace(/[^a-zA-Z0-9_]/g, "_");
                lines.push(`    ${safeType} ${safeName}${pkMark}`);
            }
            lines.push("  }");
        }
    }
    // リレーション
    for (const table of tables.slice(0, 20)) {
        for (const fk of table.foreignKeys || []) {
            if (tables.some((t) => t.name === fk.references.table)) {
                const safeSrc = table.name.replace(/[^a-zA-Z0-9_]/g, "_");
                const safeTgt = fk.references.table.replace(/[^a-zA-Z0-9_]/g, "_");
                const safeCol = fk.column.replace(/[^a-zA-Z0-9_]/g, "_");
                lines.push(`  ${safeSrc} }o--|| ${safeTgt} : "${safeCol}"`);
            }
        }
    }
    return lines.join("\n");
}
//# sourceMappingURL=db-schema.js.map