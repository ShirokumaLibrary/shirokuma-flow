/**
 * details-entity-pages - エンティティ詳細ページ生成
 *
 * Screen, Component, Action, Table, Module の個別詳細ページを生成する。
 */
import type { DetailsContext, Screen, Component, Action, Table, Module, CategorizedTestCase, TestCoverageAnalysis } from "../commands/details-types.js";
/**
 * JSON用に詳細データを収集
 */
export declare function collectDetailJsonItem(ctx: DetailsContext, type: "screen" | "component" | "action" | "module" | "table", name: string, moduleName: string, description: string, filePath: string, sourceCode: string, jsDocRaw: string, testCases: CategorizedTestCase[], analysis: TestCoverageAnalysis, related: {
    usedInScreens?: string[];
    usedInComponents?: string[];
    usedInActions?: string[];
    usedInMiddleware?: string[];
    usedInLayouts?: string[];
    usedModules?: string[];
    usedInModules?: string[];
    dbTables?: string[];
}, fullFileContent?: string): void;
/**
 * Screen 詳細ページを生成
 */
export declare function generateScreenDetailPage(screen: Screen, detailsDir: string, projectPath: string, projectName: string, ctx: DetailsContext): void;
/**
 * Component 詳細ページを生成
 */
export declare function generateComponentDetailPage(component: Component, detailsDir: string, projectPath: string, projectName: string, ctx: DetailsContext): void;
/**
 * Action 詳細ページを生成
 */
export declare function generateActionDetailPage(action: Action, detailsDir: string, projectPath: string, projectName: string, ctx: DetailsContext): void;
/**
 * Table 詳細ページを生成
 */
export declare function generateTableDetailPage(table: Table, detailsDir: string, projectPath: string, projectName: string, ctx: DetailsContext): void;
/**
 * lib/ ディレクトリのモジュールアイテム詳細ページを生成
 */
export declare function generateModuleItemDetailPage(mod: Module, featureName: string, detailsDir: string, projectPath: string, projectName: string, ctx: DetailsContext): void;
//# sourceMappingURL=details-entity-pages.d.ts.map