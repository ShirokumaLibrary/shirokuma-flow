/**
 * 検索インデックスジェネレーター
 *
 * portal/lib/search-index-generator.ts の Node.js 移植版。
 * 全データソースから検索可能なインデックスを生成する。
 */
/**
 * 全利用可能データから検索インデックスを生成する
 */
export function generateSearchIndex(featureMap, dbSchema, testCases, details) {
    const items = [];
    // フィーチャーマップのアイテムをインデックス化
    if (featureMap) {
        for (const [moduleName, group] of Object.entries(featureMap.features)) {
            // 画面
            for (const screen of group.screens || []) {
                items.push({
                    id: `screen-${moduleName}-${screen.name}`,
                    title: screen.name,
                    description: screen.description ||
                        screen.descriptionEn ||
                        `${moduleName}モジュールの画面`,
                    category: "screen",
                    module: moduleName,
                    path: `/details/screens/${encodeURIComponent(moduleName)}/${encodeURIComponent(screen.name)}`,
                    keywords: [
                        screen.route || "",
                        ...(screen.components || []),
                        ...(screen.actions || []),
                    ].filter(Boolean),
                });
            }
            // コンポーネント
            for (const component of group.components || []) {
                items.push({
                    id: `component-${moduleName}-${component.name}`,
                    title: component.name,
                    description: component.description ||
                        component.descriptionEn ||
                        `${moduleName}モジュールのコンポーネント`,
                    category: "component",
                    module: moduleName,
                    path: `/details/components/${encodeURIComponent(moduleName)}/${encodeURIComponent(component.name)}`,
                    keywords: component.props?.map((p) => p.name) || [],
                });
            }
            // アクション
            for (const action of group.actions || []) {
                items.push({
                    id: `action-${moduleName}-${action.name}`,
                    title: action.name,
                    description: action.description ||
                        action.descriptionEn ||
                        `${moduleName}モジュールのServer Action`,
                    category: "action",
                    module: moduleName,
                    path: `/details/actions/${encodeURIComponent(moduleName)}/${encodeURIComponent(action.name)}`,
                    keywords: [
                        ...(action.params?.map((p) => p.name) || []),
                        ...(action.dbTables || []),
                    ],
                });
            }
            // テーブル（フィーチャーマップより）
            for (const table of group.tables || []) {
                items.push({
                    id: `table-${moduleName}-${table.name}`,
                    title: table.name,
                    description: table.description || `${moduleName}モジュールのDBテーブル`,
                    category: "table",
                    module: moduleName,
                    path: `/details/tables/${encodeURIComponent(moduleName)}/${encodeURIComponent(table.name)}`,
                    keywords: table.columns?.map((c) => c.name) || [],
                });
            }
        }
        // 未分類アイテム
        const uncategorized = featureMap.uncategorized;
        if (uncategorized) {
            for (const screen of uncategorized.screens || []) {
                items.push({
                    id: `screen-uncategorized-${screen.name}`,
                    title: screen.name,
                    description: screen.description || screen.descriptionEn || "未分類の画面",
                    category: "screen",
                    module: "Uncategorized",
                    path: `/details/screens/Uncategorized/${encodeURIComponent(screen.name)}`,
                    keywords: [screen.route || ""].filter(Boolean),
                });
            }
        }
    }
    // DB スキーマテーブルをインデックス化
    if (dbSchema) {
        for (const table of dbSchema.tables) {
            const existingIndex = items.findIndex((item) => item.category === "table" && item.title === table.name);
            if (existingIndex === -1) {
                items.push({
                    id: `db-${table.name}`,
                    title: table.name,
                    description: table.description || `${table.category || "データベース"}テーブル`,
                    category: "db",
                    module: table.category || undefined,
                    path: `/db-schema/${encodeURIComponent(table.name)}`,
                    keywords: [
                        ...(table.columns?.map((c) => c.name) || []),
                        ...(table.foreignKeys?.map((fk) => fk.references.table) || []),
                    ],
                });
            }
            else {
                const existing = items[existingIndex];
                existing.keywords = [
                    ...existing.keywords,
                    ...(table.columns?.map((c) => c.name) || []),
                ];
                existing.path = `/db-schema/${encodeURIComponent(table.name)}`;
            }
        }
    }
    // テストケースをインデックス化（describe ブロックでグループ化）
    if (testCases) {
        const describeGroups = new Map();
        for (const tc of testCases.testCases) {
            const key = `${tc.file}:${tc.describe}`;
            const existing = describeGroups.get(key);
            if (existing) {
                existing.tests.push(tc);
            }
            else {
                describeGroups.set(key, { tests: [tc], firstTest: tc });
            }
        }
        for (const [key, { tests, firstTest }] of describeGroups) {
            const fileName = firstTest.file.split("/").pop() || firstTest.file;
            items.push({
                id: `test-${key}`,
                title: firstTest.describe,
                description: `${fileName} (${tests.length}件のテスト)`,
                category: "test",
                path: `/test-cases#${encodeURIComponent(firstTest.file)}`,
                keywords: [
                    firstTest.framework,
                    fileName,
                    ...tests.map((t) => t.it),
                ],
            });
        }
    }
    // 詳細データで既存アイテムを拡充
    if (details) {
        for (const [key, detail] of Object.entries(details.details)) {
            const [type, moduleName, name] = key.split("/");
            const existingIdx = items.findIndex((item) => item.title === name &&
                item.module === moduleName &&
                item.category === type);
            if (existingIdx !== -1) {
                const existing = items[existingIdx];
                if (detail.jsDoc?.params) {
                    existing.keywords.push(...detail.jsDoc.params.map((p) => p.name));
                }
                if (detail.related?.usedInScreens) {
                    existing.keywords.push(...detail.related.usedInScreens);
                }
                if (detail.related?.usedInComponents) {
                    existing.keywords.push(...detail.related.usedInComponents);
                }
            }
        }
    }
    // 重複除去・空キーワード除去
    for (const item of items) {
        item.keywords = [...new Set(item.keywords.filter(Boolean))];
    }
    return {
        items,
        generatedAt: new Date().toISOString(),
    };
}
//# sourceMappingURL=search-index-generator.js.map