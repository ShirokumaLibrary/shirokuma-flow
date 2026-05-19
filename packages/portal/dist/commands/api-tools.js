/**
 * API Tools documentation generator
 *
 * Parses MCP Tool[] definitions and generates documentation.
 * Supports apps/mcp/src/tools/*.ts structure.
 */
import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";
// typescript は重い依存のため、コマンド実行時のみ動的にロードする
let ts;
import { loadConfig, CONFIG_FILE } from "../utils/config.js";
import { inferAppFromPath } from "../utils/app-inference.js";
/**
 * Infer HTTP method from tool name
 *
 * Checks both prefix and suffix patterns:
 * - Prefix: get_user, list_items, search_entities
 * - Suffix: entity_get, project_list, user_delete
 */
function inferHttpMethod(toolName) {
    const name = toolName.toLowerCase();
    // GET patterns: read-only operations (prefix, suffix, or middle with _get_)
    if (name.match(/^(get|list|search|find|fetch|read|check|verify|validate)_/) ||
        name.match(/_(get|list|search|find|fetch|read|check|verify|validate)$/) ||
        name.includes("_get_") || name.includes("_list_") || name.includes("_search_")) {
        return "GET";
    }
    // DELETE patterns: removal operations (prefix or suffix)
    if (name.match(/^(delete|remove|revoke|cancel|reject)_/) ||
        name.match(/_(delete|remove|revoke|cancel|reject)$/)) {
        return "DELETE";
    }
    // PUT patterns: update operations (prefix or suffix)
    if (name.match(/^(update|edit|modify|set|change|rename|move)_/) ||
        name.match(/_(update|edit|modify|set|change|rename|move)$/)) {
        return "PUT";
    }
    // PATCH patterns: partial update operations (prefix or suffix)
    if (name.match(/^(patch|toggle|enable|disable)_/) ||
        name.match(/_(patch|toggle|enable|disable)$/)) {
        return "PATCH";
    }
    // POST patterns (default): create/action operations
    // create, add, start, complete, pause, resume, approve, defer, import, link, etc.
    return "POST";
}
/**
 * Extract JSDoc tags from a comment string
 */
function extractJsDocTags(comment) {
    const tags = {};
    const tagRegex = /@(\w+)\s+([^\n@]+)?/g;
    let match;
    while ((match = tagRegex.exec(comment)) !== null) {
        const [, tagName, tagValue] = match;
        tags[tagName] = (tagValue || "").trim();
    }
    return tags;
}
/**
 * Parse file header JSDoc for module-level annotations
 */
function parseFileHeaderAnnotations(sourceCode) {
    const headerMatch = sourceCode.match(/^\/\*\*[\s\S]*?\*\//);
    if (!headerMatch)
        return {};
    const tags = extractJsDocTags(headerMatch[0]);
    return {
        feature: tags.feature,
        dbTables: tags.dbTables?.split(",").map((t) => t.trim()),
        authLevel: tags.authLevel,
        relatedTests: tags.relatedTests,
    };
}
/**
 * Get leading JSDoc comment for a node
 */
function getLeadingJsDoc(node, sourceFile) {
    const fullText = sourceFile.getFullText();
    const nodeStart = node.getFullStart();
    // Look for JSDoc comment before the node
    const textBefore = fullText.substring(Math.max(0, nodeStart - 500), nodeStart);
    const jsDocMatch = textBefore.match(/\/\*\*[\s\S]*?\*\/\s*$/);
    return jsDocMatch ? jsDocMatch[0] : null;
}
/**
 * Parse MCP tool definitions from TypeScript source
 */
function parseApiToolsFromSource(filePath, sourceCode) {
    const tools = [];
    const app = inferAppFromPath(filePath);
    const category = path.basename(filePath, ".ts");
    // Parse file header annotations (module-level)
    const fileAnnotations = parseFileHeaderAnnotations(sourceCode);
    // Parse TypeScript AST
    const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);
    // Find Tool[] array literals
    function visit(node) {
        // Look for variable declarations with Tool[] type
        if (ts.isVariableDeclaration(node) && node.initializer) {
            if (ts.isArrayLiteralExpression(node.initializer)) {
                // Check if it's a Tool[] array
                const varName = node.name.getText(sourceFile);
                if (varName.endsWith("Tools") || varName.includes("tool")) {
                    // Parse each tool object in the array
                    for (const element of node.initializer.elements) {
                        if (ts.isObjectLiteralExpression(element)) {
                            // Get JSDoc comment before this element
                            const jsDoc = getLeadingJsDoc(element, sourceFile);
                            const toolAnnotations = jsDoc ? extractJsDocTags(jsDoc) : {};
                            const tool = parseToolObject(element, sourceFile, filePath, app, category);
                            if (tool) {
                                // Merge annotations: tool-level > file-level
                                tool.feature = toolAnnotations.feature || fileAnnotations.feature;
                                tool.dbTables = toolAnnotations.dbTables
                                    ? toolAnnotations.dbTables.split(",").map((t) => t.trim())
                                    : fileAnnotations.dbTables;
                                tool.authLevel = toolAnnotations.authLevel || fileAnnotations.authLevel;
                                tool.relatedTests = toolAnnotations.relatedTests || fileAnnotations.relatedTests;
                                tools.push(tool);
                            }
                        }
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return tools;
}
/**
 * Parse a single tool object literal
 */
function parseToolObject(obj, sourceFile, filePath, app, category) {
    let name = "";
    let description = "";
    const params = [];
    const required = [];
    for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop))
            continue;
        const propName = prop.name.getText(sourceFile);
        if (propName === "name" && ts.isStringLiteral(prop.initializer)) {
            name = prop.initializer.text;
        }
        if (propName === "description" && ts.isStringLiteral(prop.initializer)) {
            description = prop.initializer.text;
        }
        if (propName === "inputSchema" && ts.isObjectLiteralExpression(prop.initializer)) {
            // Parse inputSchema
            for (const schemaProp of prop.initializer.properties) {
                if (!ts.isPropertyAssignment(schemaProp))
                    continue;
                const schemaPropName = schemaProp.name.getText(sourceFile);
                if (schemaPropName === "properties" && ts.isObjectLiteralExpression(schemaProp.initializer)) {
                    // Parse properties
                    for (const paramProp of schemaProp.initializer.properties) {
                        if (!ts.isPropertyAssignment(paramProp))
                            continue;
                        const paramName = paramProp.name.getText(sourceFile);
                        if (ts.isObjectLiteralExpression(paramProp.initializer)) {
                            const param = parseParamObject(paramName, paramProp.initializer, sourceFile);
                            params.push(param);
                        }
                    }
                }
                if (schemaPropName === "required" && ts.isArrayLiteralExpression(schemaProp.initializer)) {
                    for (const reqElement of schemaProp.initializer.elements) {
                        if (ts.isStringLiteral(reqElement)) {
                            required.push(reqElement.text);
                        }
                    }
                }
            }
        }
    }
    // Mark required params
    for (const param of params) {
        param.required = required.includes(param.name);
    }
    if (!name)
        return null;
    return {
        name,
        description,
        params,
        sourceFile: filePath,
        app,
        category,
        httpMethod: inferHttpMethod(name),
    };
}
/**
 * Parse parameter object
 */
function parseParamObject(name, obj, sourceFile) {
    let type = "string";
    let description = "";
    let defaultValue = undefined;
    for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop))
            continue;
        const propName = prop.name.getText(sourceFile);
        if (propName === "type" && ts.isStringLiteral(prop.initializer)) {
            type = prop.initializer.text;
        }
        if (propName === "description" && ts.isStringLiteral(prop.initializer)) {
            description = prop.initializer.text;
        }
        if (propName === "default") {
            if (ts.isStringLiteral(prop.initializer)) {
                defaultValue = prop.initializer.text;
            }
            else if (ts.isNumericLiteral(prop.initializer)) {
                defaultValue = Number(prop.initializer.text);
            }
        }
    }
    return {
        name,
        type,
        description,
        required: false,
        default: defaultValue,
    };
}
/**
 * Generate HTML documentation
 */
function generateApiToolsHtml(data) {
    const toolsByCategory = {};
    for (const tool of data.tools) {
        if (!toolsByCategory[tool.category]) {
            toolsByCategory[tool.category] = [];
        }
        toolsByCategory[tool.category].push(tool);
    }
    const sidebarItems = Object.entries(toolsByCategory)
        .map(([category, tools]) => {
        const toolLinks = tools
            .map((t) => `<a href="#${t.name}" class="sidebar-subitem">${t.name}</a>`)
            .join("\n");
        return `
        <div class="sidebar-category">
          <div class="sidebar-category-title">${category}</div>
          ${toolLinks}
        </div>
      `;
    })
        .join("\n");
    const toolCards = data.tools
        .map((tool) => {
        const paramsHtml = tool.params.length
            ? `
          <div class="params-section">
            <h4>Parameters</h4>
            <table class="params-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                ${tool.params
                .map((p) => `
                  <tr>
                    <td><code>${p.name}</code></td>
                    <td><code>${p.type}</code></td>
                    <td>${p.required ? "✅" : "—"}</td>
                    <td>${p.description}${p.default !== undefined ? ` (default: ${typeof p.default === 'string' || typeof p.default === 'number' || typeof p.default === 'boolean' ? String(p.default) : JSON.stringify(p.default)})` : ""}</td>
                  </tr>
                `)
                .join("")}
              </tbody>
            </table>
          </div>
        `
            : "";
        // Auth level badge
        const authBadge = tool.authLevel
            ? `<span class="badge badge-auth badge-${tool.authLevel}">${tool.authLevel}</span>`
            : "";
        // Feature badge
        const featureBadge = tool.feature
            ? `<span class="badge badge-teal">${tool.feature}</span>`
            : "";
        // DB tables
        const dbTablesHtml = tool.dbTables?.length
            ? `<div class="meta-item"><span class="meta-label">DB:</span> ${tool.dbTables.join(", ")}</div>`
            : "";
        // Tests
        const testsHtml = tool.tests?.length
            ? `<div class="tests-section">
            <h4>Related Tests (${tool.tests.length})</h4>
            <ul class="tests-list">
              ${tool.tests.map((t) => `<li><code>${t.target}</code> - ${t.testdoc}</li>`).join("")}
            </ul>
          </div>`
            : "";
        return `
        <div class="tool-card" id="${tool.name}">
          <div class="tool-header">
            <h3 class="tool-name">${tool.name}</h3>
            <div class="tool-badges">
              <span class="badge badge-purple">${tool.category}</span>
              ${featureBadge}
              ${authBadge}
            </div>
          </div>
          <p class="tool-description">${tool.description}</p>
          ${dbTablesHtml}
          ${paramsHtml}
          ${testsHtml}
          <div class="tool-source">
            <span class="source-label">Source:</span>
            <code>${tool.sourceFile}</code>
          </div>
        </div>
      `;
    })
        .join("\n");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Tools - Documentation Portal</title>
  <style>
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #21262d;
      --border-color: #30363d;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --accent-purple: #a371f7;
      --accent-blue: #58a6ff;
      --accent-green: #3fb950;
      --accent-teal: #2dd4bf;
      --accent-orange: #f97316;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
    }

    .layout {
      display: flex;
      min-height: 100vh;
    }

    .sidebar {
      width: 280px;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      padding: 1.5rem;
      position: fixed;
      height: 100vh;
      overflow-y: auto;
    }

    .sidebar-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      color: var(--accent-purple);
    }

    .sidebar-category {
      margin-bottom: 1rem;
    }

    .sidebar-category-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      margin-bottom: 0.5rem;
      padding-left: 0.5rem;
    }

    .sidebar-subitem {
      display: block;
      padding: 0.375rem 0.75rem;
      color: var(--text-primary);
      text-decoration: none;
      font-size: 0.875rem;
      border-radius: 6px;
      margin-bottom: 2px;
    }

    .sidebar-subitem:hover {
      background: var(--bg-tertiary);
    }

    .main-content {
      flex: 1;
      margin-left: 280px;
      padding: 2rem;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .page-subtitle {
      color: var(--text-secondary);
    }

    .stats-bar {
      display: flex;
      gap: 1.5rem;
      margin-bottom: 2rem;
      padding: 1rem;
      background: var(--bg-secondary);
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }

    .stat-item {
      text-align: center;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--accent-blue);
    }

    .stat-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      text-transform: uppercase;
    }

    .tool-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .tool-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .tool-name {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--accent-blue);
    }

    .badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-weight: 500;
    }

    .badge-purple {
      background: rgba(163, 113, 247, 0.2);
      color: var(--accent-purple);
    }

    .badge-teal {
      background: rgba(45, 212, 191, 0.2);
      color: var(--accent-teal);
    }

    .badge-member {
      background: rgba(63, 185, 80, 0.2);
      color: var(--accent-green);
    }

    .badge-authenticated {
      background: rgba(88, 166, 255, 0.2);
      color: var(--accent-blue);
    }

    .badge-admin {
      background: rgba(249, 115, 22, 0.2);
      color: var(--accent-orange);
    }

    .tool-badges {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .meta-item {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin-bottom: 0.5rem;
    }

    .meta-label {
      font-weight: 500;
    }

    .tests-section {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
    }

    .tests-section h4 {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text-secondary);
    }

    .tests-list {
      list-style: none;
      font-size: 0.8125rem;
    }

    .tests-list li {
      padding: 0.25rem 0;
      color: var(--text-secondary);
    }

    .tests-list code {
      background: var(--bg-tertiary);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      color: var(--accent-green);
    }

    .tool-description {
      color: var(--text-secondary);
      margin-bottom: 1rem;
    }

    .params-section h4 {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: var(--text-secondary);
    }

    .params-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .params-table th,
    .params-table td {
      padding: 0.5rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }

    .params-table th {
      color: var(--text-secondary);
      font-weight: 500;
    }

    .params-table code {
      background: var(--bg-tertiary);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-size: 0.8125rem;
    }

    .tool-source {
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-color);
      font-size: 0.75rem;
    }

    .source-label {
      color: var(--text-secondary);
      margin-right: 0.5rem;
    }

    .tool-source code {
      color: var(--text-secondary);
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-title">API Tools</div>
      ${sidebarItems}
    </aside>

    <main class="main-content">
      <header class="page-header">
        <h1 class="page-title">API Tools Documentation</h1>
        <p class="page-subtitle">Model Context Protocol tools for AI assistants</p>
      </header>

      <div class="stats-bar">
        <div class="stat-item">
          <div class="stat-value">${data.tools.length}</div>
          <div class="stat-label">Total Tools</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.categories.length}</div>
          <div class="stat-label">Categories</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.apps.join(", ") || "—"}</div>
          <div class="stat-label">Apps</div>
        </div>
      </div>

      <section class="tools-list">
        ${toolCards}
      </section>
    </main>
  </div>
</body>
</html>`;
}
/**
 * Parse test files for @target annotations
 */
function parseTestsForTargets(projectPath) {
    const testPattern = path.join(projectPath, "apps/mcp/src/__tests__/*.test.ts");
    const testFiles = glob.sync(testPattern);
    const tests = [];
    for (const testFile of testFiles) {
        const sourceCode = fs.readFileSync(testFile, "utf-8");
        const relativePath = path.relative(projectPath, testFile);
        // Find describe blocks with @target annotation
        const describeRegex = /\/\*\*[\s\S]*?@target\s+(\S+)[\s\S]*?@testdoc\s+([^\n@]+)[\s\S]*?\*\/\s*describe\s*\(/g;
        let match;
        while ((match = describeRegex.exec(sourceCode)) !== null) {
            const [, target, testdoc] = match;
            tests.push({
                target: target.trim(),
                testdoc: testdoc.trim(),
                file: relativePath,
            });
        }
        // Also check for testdoc first, target second (different order)
        const altRegex = /\/\*\*[\s\S]*?@testdoc\s+([^\n@]+)[\s\S]*?@target\s+(\S+)[\s\S]*?\*\/\s*describe\s*\(/g;
        while ((match = altRegex.exec(sourceCode)) !== null) {
            const [, testdoc, target] = match;
            // Avoid duplicates
            if (!tests.some((t) => t.target === target.trim() && t.testdoc === testdoc.trim())) {
                tests.push({
                    target: target.trim(),
                    testdoc: testdoc.trim(),
                    file: relativePath,
                });
            }
        }
    }
    return tests;
}
/**
 * Run API Tools documentation generator
 */
export async function runApiTools(options) {
    // typescript を動的にロード（グローバルインストール時に起動を妨げないため）
    const tsModule = await import("typescript");
    ts = tsModule.default ?? tsModule;
    const { projectPath, configPath } = options;
    // Load config (optional, MCP tools don't need much config)
    const configFile = configPath || CONFIG_FILE;
    let _config = null;
    try {
        _config = loadConfig(projectPath, configFile);
    }
    catch {
        // Config is optional for api-tools
    }
    // Find MCP tool files
    const mcpPattern = path.join(projectPath, "apps/mcp/src/tools/*.ts");
    const toolFiles = glob.sync(mcpPattern, { ignore: ["**/__tests__/**", "**/*.test.ts"] });
    if (toolFiles.length === 0) {
        console.log("info", "MCP tool files not found in apps/mcp/src/tools/");
        return 0;
    }
    console.log("info", `Found ${toolFiles.length} MCP tool files`);
    // Parse all tool files
    const allTools = [];
    for (const filePath of toolFiles) {
        const sourceCode = fs.readFileSync(filePath, "utf-8");
        const relativePath = path.relative(projectPath, filePath);
        const tools = parseApiToolsFromSource(relativePath, sourceCode);
        allTools.push(...tools);
    }
    console.log("info", `Parsed ${allTools.length} MCP tools`);
    // Parse test files and link to tools
    const allTests = parseTestsForTargets(projectPath);
    console.log("info", `Found ${allTests.length} test targets`);
    // Link tests to tools and calculate coverage
    for (const tool of allTools) {
        tool.tests = allTests.filter((t) => t.target === tool.name);
        // Calculate coverage score (similar to details.ts logic)
        const testCount = tool.tests?.length || 0;
        const hasAuth = tool.authLevel && tool.authLevel !== "none";
        const hasDb = tool.dbTables && tool.dbTables.length > 0;
        let score = 0;
        if (testCount > 0) {
            // Base score for having any tests
            score = 40;
            // Bonus for multiple tests
            if (testCount >= 3)
                score += 20;
            if (testCount >= 5)
                score += 20;
            // Bonus for DB integration tests
            if (hasDb && testCount >= 2)
                score += 10;
            // Bonus for auth testing
            if (hasAuth && testCount >= 2)
                score += 10;
            score = Math.min(score, 100);
        }
        tool.testCoverage = {
            hasTest: testCount > 0,
            totalTests: testCount,
            coverageScore: score,
        };
    }
    // Build output
    const categories = [...new Set(allTools.map((t) => t.category))];
    const apps = [...new Set(allTools.map((t) => t.app))];
    const output = {
        generatedAt: new Date().toISOString(),
        projectPath,
        tools: allTools,
        categories,
        apps,
    };
    // Determine output directory
    const outputDir = options.outputDir || path.join(projectPath, "docs/portal");
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    // Write JSON
    const jsonPath = path.join(outputDir, "api-tools.json");
    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
    console.log("done", `JSON: ${jsonPath}`);
    // Write HTML
    const htmlPath = path.join(outputDir, "api-tools.html");
    const htmlContent = generateApiToolsHtml(output);
    fs.writeFileSync(htmlPath, htmlContent);
    console.log("done", `HTML: ${htmlPath}`);
    console.log("done", "MCP tools documentation generated");
    return 0;
}
//# sourceMappingURL=api-tools.js.map