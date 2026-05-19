/**
 * impact.ts - 変更影響分析コマンド
 *
 * 指定したファイル/アイテムを変更した場合に影響を受ける箇所を分析
 * レビュー時に「この変更で他のどこが影響を受けるか」を把握するのに使用
 */
import { resolve } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
const logger = createLogger();
export function impactCommand(options = {}) {
    const projectPath = process.cwd();
    const maxDepth = options.maxDepth || 5;
    // details.json を読み込む
    const detailsPath = resolve(projectPath, "docs/portal/details.json");
    if (!existsSync(detailsPath)) {
        logger.error(t("commands.impact.detailsNotFound"));
        return 1;
    }
    const detailsJson = JSON.parse(readFileSync(detailsPath, "utf-8"));
    const items = detailsJson.details;
    // 依存グラフを構築
    const dependencyGraph = buildDependencyGraph(items);
    // 対象アイテムの影響分析
    let results;
    if (options.target) {
        // 特定のアイテムのみ分析
        const targetItem = findItem(items, options.target);
        if (!targetItem) {
            logger.error(`アイテムが見つかりません: ${options.target}`);
            return 1;
        }
        results = [analyzeImpact(targetItem, dependencyGraph, maxDepth)];
    }
    else {
        // 全アイテムを分析
        results = Object.values(items).map(item => analyzeImpact(item, dependencyGraph, maxDepth));
    }
    // 影響が多い順にソート
    results.sort((a, b) => b.totalAffected - a.totalAffected);
    // 出力
    const outputDir = options.output || resolve(projectPath, "docs/portal");
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }
    const report = {
        generatedAt: new Date().toISOString(),
        items: results,
    };
    if (options.format === "table" || !options.format) {
        // コンソール出力（テーブル形式）
        printImpactTable(results, options.target);
    }
    if (options.format === "json" || !options.target) {
        // JSON出力
        const jsonPath = resolve(outputDir, "impact-analysis.json");
        writeFileSync(jsonPath, JSON.stringify(report, null, 2));
        logger.success(`JSON: ${jsonPath}`);
    }
    if (options.format === "html") {
        // HTML出力
        const htmlPath = resolve(outputDir, "impact-analysis.html");
        const html = generateImpactHtml(report);
        writeFileSync(htmlPath, html);
        logger.success(`HTML: ${htmlPath}`);
    }
    return 0;
}
function buildDependencyGraph(items) {
    const graph = new Map();
    for (const [key, item] of Object.entries(items)) {
        // このアイテムを使っているものを収集
        const dependents = new Set();
        // usedInScreens
        for (const screen of item.related.usedInScreens || []) {
            const screenKey = findKeyByName(items, screen, "screen");
            if (screenKey)
                dependents.add(screenKey);
        }
        // usedInComponents
        for (const comp of item.related.usedInComponents || []) {
            const compKey = findKeyByName(items, comp, "component");
            if (compKey)
                dependents.add(compKey);
        }
        // usedInActions
        for (const action of item.related.usedInActions || []) {
            const actionKey = findKeyByName(items, action, "action");
            if (actionKey)
                dependents.add(actionKey);
        }
        // dbTables (Action → Table)
        if (item.type === "table") {
            for (const action of item.related.usedInActions || []) {
                const actionKey = findKeyByName(items, action, "action");
                if (actionKey)
                    dependents.add(actionKey);
            }
        }
        graph.set(key, dependents);
    }
    return graph;
}
function findKeyByName(items, name, type) {
    for (const [key, item] of Object.entries(items)) {
        if (item.name === name && (!type || item.type === type)) {
            return key;
        }
    }
    return undefined;
}
function findItem(items, target) {
    // まずキーで検索
    if (items[target])
        return items[target];
    // 名前で検索
    for (const item of Object.values(items)) {
        if (item.name === target || item.filePath.includes(target)) {
            return item;
        }
    }
    return undefined;
}
// ===== 影響分析 =====
function analyzeImpact(item, graph, maxDepth) {
    const visited = new Set();
    const directImpact = [];
    const transitiveImpact = [];
    const itemKey = `${item.type}/${item.moduleName}/${item.name}`;
    const directDependents = graph.get(itemKey) || new Set();
    // 直接的な依存
    for (const depKey of directDependents) {
        const depItem = findItemByKey(graph, depKey);
        if (depItem) {
            directImpact.push({
                name: depKey.split("/").pop() || "",
                type: depKey.split("/")[0],
                path: depKey,
                depth: 1,
            });
            visited.add(depKey);
        }
    }
    // 間接的な依存（BFS）
    const queue = Array.from(directDependents).map(k => ({
        key: k,
        depth: 1,
    }));
    while (queue.length > 0) {
        const { key, depth } = queue.shift();
        if (depth >= maxDepth)
            continue;
        const nextDependents = graph.get(key) || new Set();
        for (const nextKey of nextDependents) {
            if (!visited.has(nextKey)) {
                visited.add(nextKey);
                transitiveImpact.push({
                    name: nextKey.split("/").pop() || "",
                    type: nextKey.split("/")[0],
                    path: nextKey,
                    depth: depth + 1,
                });
                queue.push({ key: nextKey, depth: depth + 1 });
            }
        }
    }
    return {
        target: {
            name: item.name,
            type: item.type,
            path: item.filePath,
        },
        directImpact,
        transitiveImpact,
        totalAffected: directImpact.length + transitiveImpact.length,
    };
}
function findItemByKey(graph, key) {
    return graph.has(key);
}
// ===== 出力生成 =====
function printImpactTable(results, target) {
    if (target) {
        // 単一アイテムの詳細表示
        const result = results[0];
        console.log(`\n📊 変更影響分析: ${result.target.name} (${result.target.type})`);
        console.log(`   ファイル: ${result.target.path}`);
        console.log(`   影響範囲: ${result.totalAffected} アイテム\n`);
        if (result.directImpact.length > 0) {
            console.log(t("commands.impact.directImpact"));
            for (const node of result.directImpact) {
                console.log(`  → ${node.type}/${node.name}`);
            }
        }
        if (result.transitiveImpact.length > 0) {
            console.log(t("commands.impact.indirectImpact"));
            for (const node of result.transitiveImpact) {
                console.log(`  ${"  ".repeat(node.depth - 1)}↳ ${node.type}/${node.name} (depth: ${node.depth})`);
            }
        }
    }
    else {
        // サマリー表示（影響が多いトップ20）
        console.log(t("commands.impact.summaryHeader"));
        console.log(t("commands.impact.summarySubheader"));
        console.log("-------|-----------|------------------");
        for (const result of results.slice(0, 20)) {
            const count = result.totalAffected.toString().padStart(5);
            const type = result.target.type.padEnd(9);
            console.log(`${count}  | ${type} | ${result.target.name}`);
        }
        console.log(`\n合計: ${results.length} アイテム分析済み`);
    }
}
function generateImpactHtml(report) {
    const rows = report.items
        .filter(r => r.totalAffected > 0)
        .map(r => `
      <tr>
        <td>${r.target.type}</td>
        <td><a href="details/${r.target.type}/${r.target.name}.html">${r.target.name}</a></td>
        <td>${r.totalAffected}</td>
        <td>${r.directImpact.map(n => n.name).join(", ") || "-"}</td>
      </tr>
    `)
        .join("");
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>変更影響分析</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 2rem; }
    h1 { color: #1a202c; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #e2e8f0; padding: 0.75rem; text-align: left; }
    th { background: #f7fafc; font-weight: 600; }
    tr:hover { background: #f7fafc; }
    a { color: #3182ce; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .meta { color: #718096; font-size: 0.875rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <h1>📊 変更影響分析</h1>
  <p class="meta">生成日時: ${report.generatedAt}</p>
  <table>
    <thead>
      <tr>
        <th>種類</th>
        <th>名前</th>
        <th>影響数</th>
        <th>直接的な依存</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
}
//# sourceMappingURL=impact.js.map