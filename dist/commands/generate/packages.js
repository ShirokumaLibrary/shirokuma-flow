/**
 * packages コマンド - モノレポパッケージドキュメント生成
 *
 * packages/ ディレクトリ内の共有パッケージをスキャンし、
 * モジュール、エクスポート、依存関係を解析してドキュメントデータを生成する。
 *
 * @module packages
 */
import { resolve, relative, basename, dirname } from "node:path";
import { globSync } from "glob";
import { loadConfig, getOutputPath } from "../../utils/config.js";
import { ensureDir, writeFile, readFile } from "../../utils/file.js";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
/**
 * packages コマンドハンドラ
 */
export function packagesCommand(options) {
    const logger = createLogger(options.verbose);
    const projectPath = resolve(options.project);
    logger.info(t("commands.packages.generating"));
    // 設定読み込み
    const config = loadConfig(projectPath, options.config);
    const packageConfigs = config.packages ?? [];
    if (packageConfigs.length === 0) {
        logger.warn(t("commands.packages.noConfig"));
        return 0;
    }
    logger.debug(`設定されたパッケージ数: ${packageConfigs.length}`);
    // 各パッケージをスキャン
    const scanResults = [];
    for (const pkgConfig of packageConfigs) {
        const pkgPath = resolve(projectPath, pkgConfig.path);
        logger.info(`スキャン中: ${pkgConfig.name} (${pkgConfig.path})`);
        const modules = scanPackageDirectory(pkgPath, pkgConfig, options.verbose);
        scanResults.push({
            name: pkgConfig.name,
            path: pkgConfig.path,
            prefix: pkgConfig.prefix,
            description: pkgConfig.description,
            icon: pkgConfig.icon,
            color: pkgConfig.color,
            modules,
        });
        logger.debug(`  モジュール数: ${modules.length}`);
    }
    // データを構築
    const packagesData = buildPackagesData(scanResults);
    // 出力先
    const portalDir = options.output
        ? resolve(options.output)
        : getOutputPath(config, projectPath, "portal");
    ensureDir(portalDir);
    // JSON 出力
    const jsonPath = resolve(portalDir, "packages.json");
    writeFile(jsonPath, JSON.stringify(packagesData, null, 2));
    logger.success(`JSON: ${jsonPath}`);
    // サマリー
    logger.success(`パッケージドキュメント生成完了`);
    logger.info(`  パッケージ: ${packagesData.summary.totalPackages}`);
    logger.info(`  モジュール: ${packagesData.summary.totalModules}`);
    logger.info(`  エクスポート: ${packagesData.summary.totalExports}`);
    return 0;
}
/**
 * パッケージディレクトリをスキャン
 */
function scanPackageDirectory(pkgPath, config, _verbose) {
    const modules = [];
    // エントリポイントを決定
    const entryPoints = config.entryPoints ?? ["src/**/*.ts"];
    const excludePatterns = [
        "**/node_modules/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "**/*.d.ts",
    ];
    // ファイルを収集
    const files = [];
    for (const pattern of entryPoints) {
        const matches = globSync(pattern, {
            cwd: pkgPath,
            absolute: true,
            ignore: excludePatterns,
        });
        files.push(...matches);
    }
    // 各ファイルをスキャン
    for (const file of files) {
        const content = readFile(file);
        if (!content)
            continue;
        const relativePath = relative(pkgPath, file);
        const moduleData = scanPackageModules(content, relativePath);
        if (moduleData && moduleData.exports.length > 0) {
            modules.push(moduleData);
        }
    }
    return modules;
}
/**
 * ファイルからモジュール情報をスキャン
 */
export function scanPackageModules(content, filePath) {
    const exports = [];
    const dependencies = [];
    // モジュール名を決定（ファイル名から）
    let moduleName = basename(filePath, ".ts");
    if (moduleName === "index") {
        moduleName = basename(dirname(filePath)) || "index";
    }
    // @module タグからモジュール名を取得
    const moduleTagMatch = content.match(/@module\s+(\w+)/);
    if (moduleTagMatch) {
        moduleName = moduleTagMatch[1];
    }
    // モジュール説明を取得
    let description;
    const headerJsdocMatch = content.match(/^\/\*\*[\s\S]*?\*\//);
    if (headerJsdocMatch) {
        const descMatch = headerJsdocMatch[0].match(/\*\s+([^@*\n][^\n]*)/);
        if (descMatch) {
            description = descMatch[1].trim();
        }
    }
    // export function を検出
    const functionRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
    for (const match of content.matchAll(functionRegex)) {
        const name = match[1];
        const jsdoc = extractPrecedingJsdoc(content, match.index);
        exports.push({
            name,
            kind: "function",
            description: jsdoc?.description,
        });
    }
    // export const を検出
    const constRegex = /export\s+const\s+(\w+)/g;
    for (const match of content.matchAll(constRegex)) {
        const name = match[1];
        const jsdoc = extractPrecedingJsdoc(content, match.index);
        exports.push({
            name,
            kind: "const",
            description: jsdoc?.description,
        });
    }
    // export interface を検出
    const interfaceRegex = /export\s+interface\s+(\w+)/g;
    for (const match of content.matchAll(interfaceRegex)) {
        const name = match[1];
        const jsdoc = extractPrecedingJsdoc(content, match.index);
        exports.push({
            name,
            kind: "interface",
            description: jsdoc?.description,
        });
    }
    // export type を検出
    const typeRegex = /export\s+type\s+(\w+)/g;
    for (const match of content.matchAll(typeRegex)) {
        const name = match[1];
        const jsdoc = extractPrecedingJsdoc(content, match.index);
        exports.push({
            name,
            kind: "type",
            description: jsdoc?.description,
        });
    }
    // export class を検出
    const classRegex = /export\s+class\s+(\w+)/g;
    for (const match of content.matchAll(classRegex)) {
        const name = match[1];
        const jsdoc = extractPrecedingJsdoc(content, match.index);
        exports.push({
            name,
            kind: "class",
            description: jsdoc?.description,
        });
    }
    // export enum を検出
    const enumRegex = /export\s+enum\s+(\w+)/g;
    for (const match of content.matchAll(enumRegex)) {
        const name = match[1];
        const jsdoc = extractPrecedingJsdoc(content, match.index);
        exports.push({
            name,
            kind: "enum",
            description: jsdoc?.description,
        });
    }
    // import 文から依存関係を抽出
    const importRegex = /import\s+.*?\s+from\s+["']([^"']+)["']/g;
    for (const match of content.matchAll(importRegex)) {
        const importPath = match[1];
        // ローカルインポートのみ追跡
        if (importPath.startsWith("./") || importPath.startsWith("../")) {
            dependencies.push(importPath);
        }
    }
    if (exports.length === 0) {
        return null;
    }
    return {
        name: moduleName,
        path: filePath,
        description,
        exports,
        dependencies,
    };
}
/**
 * 直前のJSDocコメントを抽出
 */
function extractPrecedingJsdoc(content, matchIndex) {
    // マッチ位置より前の内容を取得
    const beforeMatch = content.slice(0, matchIndex);
    // 末尾から見て、直前の */ を探す（空白のみ許容）
    const jsdocEndPattern = /\*\/\s*$/;
    const jsdocEndMatch = beforeMatch.match(jsdocEndPattern);
    if (!jsdocEndMatch) {
        return null;
    }
    // 最後の */ の位置を特定
    const lastJsdocEnd = beforeMatch.lastIndexOf("*/");
    if (lastJsdocEnd === -1) {
        return null;
    }
    // */ の位置から、その後に空白以外がないか確認
    const afterJsdocEnd = beforeMatch.slice(lastJsdocEnd + 2);
    if (!/^\s*$/.test(afterJsdocEnd)) {
        return null;
    }
    // この */ に対応する /** を探す
    const searchArea = beforeMatch.slice(0, lastJsdocEnd);
    const jsdocStart = searchArea.lastIndexOf("/**");
    if (jsdocStart === -1) {
        return null;
    }
    const jsdoc = beforeMatch.slice(jsdocStart, lastJsdocEnd + 2);
    // 説明を抽出（@タグ以外の行）
    const lines = jsdoc.split("\n");
    const descriptionLines = [];
    for (const line of lines) {
        const trimmed = line.replace(/^\s*\*?\s*/, "").trim();
        if (trimmed.startsWith("@") || trimmed === "/**" || trimmed === "*/") {
            continue;
        }
        if (trimmed) {
            descriptionLines.push(trimmed);
        }
    }
    return {
        description: descriptionLines.length > 0 ? descriptionLines.join(" ") : undefined,
    };
}
/**
 * パッケージデータを構築
 */
export function buildPackagesData(scanResults) {
    const packages = scanResults.map((result) => {
        const modules = result.modules;
        let exportCount = 0;
        let typeCount = 0;
        let functionCount = 0;
        for (const mod of modules) {
            for (const exp of mod.exports) {
                exportCount++;
                if (exp.kind === "type" || exp.kind === "interface") {
                    typeCount++;
                }
                else if (exp.kind === "function") {
                    functionCount++;
                }
            }
        }
        return {
            name: result.name,
            path: result.path,
            prefix: result.prefix,
            description: result.description,
            icon: result.icon,
            color: result.color,
            modules: modules,
            stats: {
                moduleCount: modules.length,
                exportCount,
                typeCount,
                functionCount,
            },
        };
    });
    // サマリー計算
    const totalPackages = packages.length;
    const totalModules = packages.reduce((sum, pkg) => sum + pkg.stats.moduleCount, 0);
    const totalExports = packages.reduce((sum, pkg) => sum + pkg.stats.exportCount, 0);
    return {
        packages,
        summary: {
            totalPackages,
            totalModules,
            totalExports,
        },
        generatedAt: new Date().toISOString(),
    };
}
//# sourceMappingURL=packages.js.map