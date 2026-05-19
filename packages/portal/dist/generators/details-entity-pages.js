/**
 * details-entity-pages - エンティティ詳細ページ生成
 *
 * Screen, Component, Action, Table, Module の個別詳細ページを生成する。
 */
import { resolve } from "node:path";
import { ensureDir, writeFile } from "../utils/file.js";
import { inferAppFromPath } from "../utils/app-inference.js";
import { extractModuleName, readSourceCode, extractFunctionCode } from "../commands/details-context.js";
import { extractJSDoc, parseJSDocForJson } from "../parsers/details-jsdoc.js";
import { parseZodSchema } from "../parsers/details-zod.js";
import { findTestCasesForElement, analyzeTestCoverage } from "../analyzers/details-test-analysis.js";
import { generateDetailHTML } from "./details-html.js";
/**
 * ファイル名をサニタイズしてパストラバーサルを防止
 */
function sanitizeFileName(name) {
    // パス区切り文字とパストラバーサルパターンを除去
    return name
        .replace(/[/\\]/g, "_")
        .replace(/\.\./g, "_")
        .replace(/^\./, "_");
}
// ===== JSON データ収集 =====
/**
 * JSON用に詳細データを収集
 */
export function collectDetailJsonItem(ctx, type, name, moduleName, description, filePath, sourceCode, jsDocRaw, testCases, analysis, related, fullFileContent) {
    const parsed = parseJSDocForJson(jsDocRaw);
    const byCategory = {};
    for (const [cat, cases] of Object.entries(analysis.byCategory)) {
        byCategory[cat] = cases.map((tc) => ({
            name: tc.it,
            file: tc.file,
            line: tc.line,
            summary: tc.summary,
            purpose: tc.purpose,
            expected: tc.expected,
            bdd: tc.bdd,
        }));
    }
    // 新規タグの処理
    const inputSchemaTag = parsed.tags.find((t) => t.name === "inputSchema");
    const outputSchemaTag = parsed.tags.find((t) => t.name === "outputSchema");
    const errorCodesTag = parsed.tags.find((t) => t.name === "errorCodes");
    const authLevelTag = parsed.tags.find((t) => t.name === "authLevel");
    const rateLimitTag = parsed.tags.find((t) => t.name === "rateLimit");
    const csrfProtectionTag = parsed.tags.find((t) => t.name === "csrfProtection");
    let inputSchema;
    const schemaSearchSource = fullFileContent || sourceCode;
    if (inputSchemaTag && schemaSearchSource) {
        const schemaName = inputSchemaTag.value.trim();
        const parsedSchema = parseZodSchema(schemaName, schemaSearchSource);
        if (parsedSchema) {
            inputSchema = parsedSchema;
        }
    }
    let outputSchema;
    if (outputSchemaTag) {
        const outputType = outputSchemaTag.value.trim();
        outputSchema = {
            type: outputType,
            successType: outputType.includes("void") ? "void" : outputType.replace(/\s*\|\s*ActionResult/g, ""),
            errorType: outputType.includes("ActionResult") ? "ActionResult" : undefined,
        };
    }
    let errorCodes;
    if (errorCodesTag) {
        const lines = errorCodesTag.value.split("\n");
        errorCodes = [];
        for (const line of lines) {
            const match = line.match(/^\s*-\s*(\w+):\s*(.+?)(?:\s+\((\d+)\))?$/);
            if (match) {
                errorCodes.push({
                    code: match[1],
                    description: match[2].trim(),
                    status: match[3] ? parseInt(match[3], 10) : undefined,
                });
            }
        }
    }
    let authLevel;
    if (authLevelTag) {
        const level = authLevelTag.value.trim();
        if (["none", "authenticated", "member", "admin"].includes(level)) {
            authLevel = level;
        }
    }
    const rateLimit = rateLimitTag ? rateLimitTag.value.trim() : undefined;
    let csrfProtection;
    if (csrfProtectionTag) {
        const value = csrfProtectionTag.value.trim().toLowerCase();
        csrfProtection = value === "" || value === "true" || value === "yes" || value === "1";
    }
    const app = inferAppFromPath(filePath);
    const key = `${type}/${moduleName}/${name}`;
    const existingItem = ctx.detailsJsonItems[key];
    if (existingItem) {
        const mergedRelated = {
            usedInScreens: [...new Set([...(existingItem.related.usedInScreens || []), ...(related.usedInScreens || [])])],
            usedInComponents: [...new Set([...(existingItem.related.usedInComponents || []), ...(related.usedInComponents || [])])],
            usedInActions: [...new Set([...(existingItem.related.usedInActions || []), ...(related.usedInActions || [])])],
            usedInMiddleware: [...new Set([...(existingItem.related.usedInMiddleware || []), ...(related.usedInMiddleware || [])])],
            usedInLayouts: [...new Set([...(existingItem.related.usedInLayouts || []), ...(related.usedInLayouts || [])])],
            usedModules: [...new Set([...(existingItem.related.usedModules || []), ...(related.usedModules || [])])],
            usedInModules: [...new Set([...(existingItem.related.usedInModules || []), ...(related.usedInModules || [])])],
            dbTables: [...new Set([...(existingItem.related.dbTables || []), ...(related.dbTables || [])])],
        };
        existingItem.related = mergedRelated;
        if (existingItem.app !== app) {
            existingItem.app = `${existingItem.app}, ${app}`;
        }
        return;
    }
    ctx.detailsJsonItems[key] = {
        name,
        type,
        moduleName,
        description,
        filePath,
        sourceCode,
        app,
        jsDoc: parsed,
        related,
        testCoverage: {
            hasTest: testCases.length > 0,
            totalTests: testCases.length,
            coverageScore: analysis.coverageScore,
            byCategory,
            recommendations: analysis.recommendations,
        },
        inputSchema,
        outputSchema,
        errorCodes,
        authLevel,
        rateLimit,
        csrfProtection,
    };
}
// ===== ページ生成 =====
/**
 * Screen 詳細ページを生成
 */
export function generateScreenDetailPage(screen, detailsDir, projectPath, projectName, ctx) {
    const moduleName = extractModuleName(screen.path);
    const sourceCode = readSourceCode(projectPath, screen.path);
    const extractedCode = extractFunctionCode(sourceCode, screen.name);
    const jsDoc = extractJSDoc(sourceCode, screen.name);
    const testCases = findTestCasesForElement(screen.name, screen.path, ctx);
    const analysis = analyzeTestCoverage(testCases, false, false);
    const html = generateDetailHTML({
        type: "screen",
        name: screen.name,
        moduleName,
        description: screen.description,
        filePath: screen.path,
        route: screen.route,
        code: extractedCode,
        jsDoc,
        testCases,
        testAnalysis: analysis,
        related: [
            { type: "Components", items: screen.usedComponents || [], linkType: "component", sourcePath: screen.path },
            { type: "Actions", items: screen.usedActions || [], linkType: "action", sourcePath: screen.path },
        ],
        projectName,
    }, ctx);
    const moduleDir = resolve(detailsDir, "screen", sanitizeFileName(moduleName));
    ensureDir(moduleDir);
    writeFile(resolve(moduleDir, `${sanitizeFileName(screen.name)}.html`), html);
    collectDetailJsonItem(ctx, "screen", screen.name, moduleName, screen.description, screen.path, extractedCode, jsDoc, testCases, analysis, { usedInComponents: screen.usedComponents, usedInActions: screen.usedActions });
}
/**
 * Component 詳細ページを生成
 */
export function generateComponentDetailPage(component, detailsDir, projectPath, projectName, ctx) {
    const moduleName = extractModuleName(component.path);
    const sourceCode = readSourceCode(projectPath, component.path);
    const extractedCode = extractFunctionCode(sourceCode, component.name);
    const jsDoc = extractJSDoc(sourceCode, component.name);
    const testCases = findTestCasesForElement(component.name, component.path, ctx);
    const analysis = analyzeTestCoverage(testCases, false, false);
    const html = generateDetailHTML({
        type: "component",
        name: component.name,
        moduleName,
        description: component.description,
        filePath: component.path,
        code: extractedCode,
        jsDoc,
        testCases,
        testAnalysis: analysis,
        related: [
            { type: "Used in Screens", items: component.usedInScreens || [], linkType: "screen", sourcePath: component.path },
            { type: "Used in Components", items: component.usedInComponents || [], linkType: "component", sourcePath: component.path },
            { type: "Actions", items: component.usedActions || [], linkType: "action", sourcePath: component.path },
        ],
        projectName,
    }, ctx);
    const moduleDir = resolve(detailsDir, "component", sanitizeFileName(moduleName));
    ensureDir(moduleDir);
    writeFile(resolve(moduleDir, `${sanitizeFileName(component.name)}.html`), html);
    collectDetailJsonItem(ctx, "component", component.name, moduleName, component.description, component.path, extractedCode, jsDoc, testCases, analysis, {
        usedInScreens: component.usedInScreens, usedInComponents: component.usedInComponents, usedInActions: component.usedActions,
    });
}
/**
 * Action 詳細ページを生成
 */
export function generateActionDetailPage(action, detailsDir, projectPath, projectName, ctx) {
    const moduleName = extractModuleName(action.path);
    const sourceCode = readSourceCode(projectPath, action.path);
    const extractedCode = extractFunctionCode(sourceCode, action.name);
    const jsDoc = extractJSDoc(sourceCode, action.name);
    const testCases = findTestCasesForElement(action.name, action.path, ctx);
    const hasAuth = /getSession|requireAuth|permission|role/i.test(sourceCode);
    const hasDb = (action.dbTables?.length || 0) > 0;
    const analysis = analyzeTestCoverage(testCases, hasAuth, hasDb);
    const html = generateDetailHTML({
        type: "action",
        name: action.name,
        moduleName,
        description: action.description,
        filePath: action.path,
        code: extractedCode,
        jsDoc,
        testCases,
        testAnalysis: analysis,
        related: [
            { type: "Used in Screens", items: action.usedInScreens || [], linkType: "screen", sourcePath: action.path },
            { type: "Used in Components", items: action.usedInComponents || [], linkType: "component", sourcePath: action.path },
            { type: "DB Tables", items: action.dbTables || [], linkType: "table", sourcePath: action.path },
        ],
        projectName,
        actionType: action.actionType,
    }, ctx);
    const moduleDir = resolve(detailsDir, "action", sanitizeFileName(moduleName));
    ensureDir(moduleDir);
    writeFile(resolve(moduleDir, `${sanitizeFileName(action.name)}.html`), html);
    collectDetailJsonItem(ctx, "action", action.name, moduleName, action.description, action.path, extractedCode, jsDoc, testCases, analysis, {
        usedInScreens: action.usedInScreens, usedInComponents: action.usedInComponents, dbTables: action.dbTables,
    }, sourceCode);
}
/**
 * Table 詳細ページを生成
 */
export function generateTableDetailPage(table, detailsDir, projectPath, projectName, ctx) {
    const moduleName = extractModuleName(table.path);
    const sourceCode = readSourceCode(projectPath, table.path);
    const extractedCode = extractFunctionCode(sourceCode, table.name);
    const jsDoc = extractJSDoc(sourceCode, table.name);
    const testCases = findTestCasesForElement(table.name, table.path, ctx);
    const analysis = analyzeTestCoverage(testCases, false, true);
    const html = generateDetailHTML({
        type: "table",
        name: table.name,
        moduleName,
        description: table.description,
        filePath: table.path,
        code: extractedCode,
        jsDoc,
        testCases,
        testAnalysis: analysis,
        related: [{ type: "Used in Actions", items: table.usedInActions || [], linkType: "action", sourcePath: table.path }],
        projectName,
    }, ctx);
    const moduleDir = resolve(detailsDir, "table", sanitizeFileName(moduleName));
    ensureDir(moduleDir);
    writeFile(resolve(moduleDir, `${sanitizeFileName(table.name)}.html`), html);
    collectDetailJsonItem(ctx, "table", table.name, moduleName, table.description, table.path, extractedCode, jsDoc, testCases, analysis, { usedInActions: table.usedInActions });
}
/**
 * lib/ ディレクトリのモジュールアイテム詳細ページを生成
 */
export function generateModuleItemDetailPage(mod, featureName, detailsDir, projectPath, projectName, ctx) {
    const moduleName = featureName;
    const sourceCode = readSourceCode(projectPath, mod.path);
    const extractedCode = extractFunctionCode(sourceCode, mod.name) || sourceCode;
    const jsDoc = extractJSDoc(sourceCode, mod.name);
    const testCases = findTestCasesForElement(mod.name, mod.path, ctx);
    const analysis = analyzeTestCoverage(testCases, false, false);
    const html = generateDetailHTML({
        type: "module",
        name: mod.name,
        moduleName,
        description: mod.description || "",
        filePath: mod.path,
        code: extractedCode,
        jsDoc,
        testCases,
        testAnalysis: analysis,
        related: [
            { type: "Used in Screens", items: mod.usedInScreens || [], linkType: "screen", sourcePath: mod.path },
            { type: "Used in Components", items: mod.usedInComponents || [], linkType: "component", sourcePath: mod.path },
            { type: "Used in Actions", items: mod.usedInActions || [], linkType: "action", sourcePath: mod.path },
            { type: "Used in Middleware", items: mod.usedInMiddleware || [], linkType: "middleware", sourcePath: mod.path },
            { type: "Used in Layouts", items: mod.usedInLayouts || [], linkType: "layout", sourcePath: mod.path },
            { type: "Uses Modules", items: mod.usedModules || [], linkType: "module", sourcePath: mod.path },
            { type: "Used by Modules", items: mod.usedInModules || [], linkType: "module", sourcePath: mod.path },
        ],
        projectName,
    }, ctx);
    const moduleDir = resolve(detailsDir, "module", sanitizeFileName(moduleName));
    ensureDir(moduleDir);
    writeFile(resolve(moduleDir, `${sanitizeFileName(mod.name)}.html`), html);
    collectDetailJsonItem(ctx, "module", mod.name, moduleName, mod.description || "", mod.path, extractedCode, jsDoc, testCases, analysis, {
        usedInScreens: mod.usedInScreens, usedInComponents: mod.usedInComponents, usedInActions: mod.usedInActions,
        usedInMiddleware: mod.usedInMiddleware, usedInLayouts: mod.usedInLayouts, usedModules: mod.usedModules, usedInModules: mod.usedInModules,
    });
}
//# sourceMappingURL=details-entity-pages.js.map