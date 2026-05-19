/**
 * reference-analyzer.ts - ts-morph を使った自動参照解析
 *
 * コードベースを解析し、以下の使用関係を自動検出する：
 * - Screen → Component: import + JSX使用
 * - Screen → Action: import + 関数呼び出し
 * - Component → Action: import + 関数呼び出し
 * - Module → (逆参照): 上記から逆引き
 */
import { Project, SyntaxKind, Node } from "ts-morph";
import { resolve, relative, dirname, basename } from "node:path";
import { createLogger } from "../utils/logger.js";
import { t } from "../utils/i18n.js";
const logger = createLogger();
// ===== デフォルトパターン =====
const DEFAULT_COMPONENT_PATTERNS = [
    /\/components\//,
    /@\/components\//, // @/components/ エイリアス形式
    /\/app\/.*\/components\//,
];
const DEFAULT_ACTION_PATTERNS = [
    /\/lib\/actions\//,
    /@\/lib\/actions\//, // @/lib/actions/ エイリアス形式
    /\/actions\//,
    /@\/actions\//, // @/actions/ エイリアス形式
];
const DEFAULT_MODULE_PATTERNS = [
    /\/lib\/(?!actions)/, // lib/ 配下で actions 以外
    /@\/lib\/(?!actions)/, // @/lib/ エイリアス形式（actions以外）
];
// ===== メイン解析関数 =====
/**
 * プロジェクトの参照関係を解析する
 */
export function analyzeProjectReferences(options) {
    const { projectPath, tsConfigPath, targetFiles, componentPatterns = DEFAULT_COMPONENT_PATTERNS, actionPatterns = DEFAULT_ACTION_PATTERNS, modulePatterns = DEFAULT_MODULE_PATTERNS, verbose = false, } = options;
    if (verbose) {
        logger.info(t("commands.referenceAnalyzer.starting", { count: targetFiles.length }));
    }
    // ts-morph プロジェクトを初期化
    const project = new Project({
        tsConfigFilePath: tsConfigPath || resolve(projectPath, "tsconfig.json"),
        skipAddingFilesFromTsConfig: true,
    });
    // 対象ファイルを追加
    for (const file of targetFiles) {
        try {
            project.addSourceFileAtPath(file);
        }
        catch {
            // ファイルが存在しない場合はスキップ
            if (verbose) {
                logger.warn(t("commands.referenceAnalyzer.fileSkipped", { file }));
            }
        }
    }
    const fileUsages = new Map();
    const sourceFiles = project.getSourceFiles();
    if (verbose) {
        logger.info(t("commands.referenceAnalyzer.targetFiles", { count: sourceFiles.length }));
    }
    // 各ファイルを解析
    for (const sourceFile of sourceFiles) {
        const filePath = relative(projectPath, sourceFile.getFilePath());
        const usage = analyzeFileUsage(sourceFile, projectPath, componentPatterns, actionPatterns, modulePatterns);
        if (usage.usedComponents.length > 0 ||
            usage.usedActions.length > 0 ||
            usage.usedModules.length > 0) {
            fileUsages.set(filePath, usage);
        }
    }
    // 逆参照マップを構築
    const reverseRefs = buildReverseReferences(fileUsages);
    if (verbose) {
        logger.info(t("commands.referenceAnalyzer.done", { count: fileUsages.size }));
    }
    // メモリ解放
    project.getSourceFiles().forEach(sf => project.removeSourceFile(sf));
    return { fileUsages, reverseRefs };
}
// ===== ファイル解析 =====
/**
 * 単一ファイルの使用関係を解析
 */
function analyzeFileUsage(sourceFile, projectPath, componentPatterns, actionPatterns, modulePatterns) {
    const filePath = relative(projectPath, sourceFile.getFilePath());
    const usedComponents = [];
    const usedActions = [];
    const usedModules = [];
    const usedModulePaths = [];
    // import 文を解析
    const imports = sourceFile.getImportDeclarations();
    for (const imp of imports) {
        const moduleSpecifier = imp.getModuleSpecifierValue();
        // 外部パッケージはスキップ
        if (!moduleSpecifier.startsWith(".") && !moduleSpecifier.startsWith("@/")) {
            continue;
        }
        // import 元のカテゴリを判定
        const importCategory = categorizeImport(moduleSpecifier, componentPatterns, actionPatterns, modulePatterns);
        if (importCategory === "none")
            continue;
        // モジュールの場合、パスも記録
        if (importCategory === "module") {
            const resolvedPath = resolveModulePath(moduleSpecifier, filePath, projectPath);
            if (resolvedPath) {
                usedModulePaths.push(resolvedPath);
            }
        }
        // named import を抽出
        const namedImports = imp.getNamedImports();
        for (const named of namedImports) {
            const name = named.getName();
            switch (importCategory) {
                case "component":
                    // JSX で実際に使用されているか確認
                    if (isUsedAsJsxElement(sourceFile, name)) {
                        usedComponents.push(name);
                    }
                    break;
                case "action":
                    // 関数として呼び出されているか確認
                    if (isCalledAsFunction(sourceFile, name)) {
                        usedActions.push(name);
                    }
                    break;
                case "module":
                    // import されていれば使用とみなす
                    usedModules.push(name);
                    break;
            }
        }
        // default import を抽出
        const defaultImport = imp.getDefaultImport();
        if (defaultImport) {
            const name = defaultImport.getText();
            switch (importCategory) {
                case "component":
                    if (isUsedAsJsxElement(sourceFile, name)) {
                        usedComponents.push(name);
                    }
                    break;
                case "action":
                    if (isCalledAsFunction(sourceFile, name)) {
                        usedActions.push(name);
                    }
                    break;
                case "module":
                    usedModules.push(name);
                    break;
            }
        }
    }
    return {
        filePath,
        usedComponents: [...new Set(usedComponents)],
        usedActions: [...new Set(usedActions)],
        usedModules: [...new Set(usedModules)],
        usedModulePaths: [...new Set(usedModulePaths)],
    };
}
/**
 * モジュールspecifierからファイルパスを解決
 * @example "@/lib/auth/client" → "apps/admin/lib/auth/client.ts"
 */
function resolveModulePath(moduleSpecifier, importerPath, projectPath) {
    // @/ エイリアスの処理
    if (moduleSpecifier.startsWith("@/")) {
        // @/lib/auth/client → lib/auth/client
        const aliasPath = moduleSpecifier.slice(2);
        // importer のアプリディレクトリを取得
        const appMatch = importerPath.match(/^(apps\/[^/]+)\//);
        if (appMatch) {
            const appDir = appMatch[1];
            // 拡張子がない場合は .ts を追加
            const fullPath = `${appDir}/${aliasPath}`;
            return fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")
                ? fullPath
                : `${fullPath}.ts`;
        }
        return null;
    }
    // 相対パスの処理
    if (moduleSpecifier.startsWith(".")) {
        const importerDir = dirname(importerPath);
        const resolvedPath = resolve(importerDir, moduleSpecifier);
        const relativePath = relative(projectPath, resolvedPath);
        return relativePath.endsWith(".ts") || relativePath.endsWith(".tsx")
            ? relativePath
            : `${relativePath}.ts`;
    }
    return null;
}
/**
 * import 元のカテゴリを判定
 */
function categorizeImport(moduleSpecifier, componentPatterns, actionPatterns, modulePatterns) {
    // コンポーネント
    for (const pattern of componentPatterns) {
        if (pattern.test(moduleSpecifier)) {
            return "component";
        }
    }
    // アクション
    for (const pattern of actionPatterns) {
        if (pattern.test(moduleSpecifier)) {
            return "action";
        }
    }
    // モジュール
    for (const pattern of modulePatterns) {
        if (pattern.test(moduleSpecifier)) {
            return "module";
        }
    }
    return "none";
}
/**
 * 名前が JSX 要素として使用されているか確認
 */
function isUsedAsJsxElement(sourceFile, name) {
    // JsxOpeningElement と JsxSelfClosingElement を検索
    const jsxElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
    const jsxSelfClosing = sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
    for (const element of [...jsxElements, ...jsxSelfClosing]) {
        const tagName = element.getTagNameNode().getText();
        // 完全一致またはドット記法の先頭部分が一致
        if (tagName === name || tagName.startsWith(`${name}.`)) {
            return true;
        }
    }
    return false;
}
/**
 * 名前が関数として呼び出されているか確認
 */
function isCalledAsFunction(sourceFile, name) {
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of callExpressions) {
        const expression = call.getExpression();
        const text = expression.getText();
        // 直接呼び出し: actionName()
        if (text === name) {
            return true;
        }
        // await 呼び出し: await actionName()
        // チェーン呼び出し: actionName.bind()
        if (text.startsWith(`${name}.`) || text.startsWith(`${name}(`)) {
            return true;
        }
    }
    // AwaitExpression 内の呼び出しもチェック
    const awaitExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.AwaitExpression);
    for (const awaitExpr of awaitExpressions) {
        const expression = awaitExpr.getExpression();
        if (Node.isCallExpression(expression)) {
            const calleeText = expression.getExpression().getText();
            if (calleeText === name) {
                return true;
            }
        }
    }
    return false;
}
// ===== 逆参照マップ構築 =====
/**
 * ファイル使用情報から逆参照マップを構築
 */
function buildReverseReferences(fileUsages) {
    const componentToFiles = new Map();
    const actionToFiles = new Map();
    const moduleToFiles = new Map();
    const modulePathToFiles = new Map();
    for (const [filePath, usage] of fileUsages) {
        // コンポーネントの逆参照
        for (const comp of usage.usedComponents) {
            const existing = componentToFiles.get(comp) || [];
            existing.push(filePath);
            componentToFiles.set(comp, existing);
        }
        // アクションの逆参照
        for (const action of usage.usedActions) {
            const existing = actionToFiles.get(action) || [];
            existing.push(filePath);
            actionToFiles.set(action, existing);
        }
        // モジュールの逆参照（シンボル名）
        for (const mod of usage.usedModules) {
            const existing = moduleToFiles.get(mod) || [];
            existing.push(filePath);
            moduleToFiles.set(mod, existing);
        }
        // モジュールの逆参照（ファイルパス）
        for (const modPath of usage.usedModulePaths) {
            const existing = modulePathToFiles.get(modPath) || [];
            existing.push(filePath);
            modulePathToFiles.set(modPath, existing);
        }
    }
    return {
        componentToFiles,
        actionToFiles,
        moduleToFiles,
        modulePathToFiles,
    };
}
// ===== ユーティリティ関数 =====
/**
 * ファイルパスから要素名を抽出
 * 例: "apps/admin/app/[locale]/posts/page.tsx" → "PostsScreen"
 */
export function extractElementNameFromPath(filePath, type) {
    const fileName = basename(filePath, ".tsx").replace(".ts", "");
    switch (type) {
        case "screen":
            // page.tsx → 親ディレクトリ名 + Screen
            if (fileName === "page") {
                const dir = basename(dirname(filePath));
                // [locale] などの動的セグメントは除外
                if (dir.startsWith("[") && dir.endsWith("]")) {
                    const parentDir = basename(dirname(dirname(filePath)));
                    return toPascalCase(parentDir) + "Screen";
                }
                return toPascalCase(dir) + "Screen";
            }
            return toPascalCase(fileName) + "Screen";
        case "component":
            return toPascalCase(fileName);
        case "action":
            return fileName; // アクションは camelCase のまま
    }
}
/**
 * kebab-case/snake_case を PascalCase に変換
 */
function toPascalCase(str) {
    return str
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
}
/**
 * ファイルパスが Screen ファイルかどうか判定
 */
export function isScreenFile(filePath) {
    return filePath.includes("/app/") && filePath.endsWith("/page.tsx");
}
/**
 * ファイルパスが Component ファイルかどうか判定
 */
export function isComponentFile(filePath) {
    return filePath.includes("/components/") && filePath.endsWith(".tsx");
}
/**
 * ファイルパスが Action ファイルかどうか判定
 */
export function isActionFile(filePath) {
    return (filePath.includes("/lib/actions/") || filePath.includes("/actions/"))
        && filePath.endsWith(".ts");
}
/**
 * ファイルパスが Middleware ファイルかどうか判定
 */
export function isMiddlewareFile(filePath) {
    return filePath.endsWith("/middleware.ts") || filePath.endsWith("/middleware.tsx");
}
/**
 * ファイルパスが Layout ファイルかどうか判定
 */
export function isLayoutFile(filePath) {
    return filePath.includes("/app/") && filePath.endsWith("/layout.tsx");
}
//# sourceMappingURL=reference-analyzer.js.map