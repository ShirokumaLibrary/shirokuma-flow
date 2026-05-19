/**
 * details-context - コンテキスト管理・要素リンク解決
 *
 * DetailsContext の作成、要素マップ管理、リンク解決、
 * モジュール名抽出、ソースコード読み込みを提供する。
 */
import type { DetailsContext } from "./details-types.js";
/**
 * 空の DetailsContext を作成
 */
export declare function createDetailsContext(): DetailsContext;
/**
 * ファイルパスからモジュール名を抽出
 */
export declare function extractModuleName(filePath: string): string;
/**
 * 要素の完全キーを生成
 */
export declare function getElementFullKey(moduleName: string, elementName: string): string;
/**
 * linkTypeに対応する存在要素マップを取得
 */
export declare function getExistingMap(ctx: DetailsContext, linkType: string): Map<string, string>;
/**
 * 要素名からリンク情報を検索
 */
export declare function findElementLink(ctx: DetailsContext, linkType: string, elementName: string): {
    module: string;
} | null;
/**
 * ソースコードを読み込み
 */
export declare function readSourceCode(projectPath: string, filePath: string): string;
/**
 * 関数/コンポーネントのコードを抽出
 */
export declare function extractFunctionCode(sourceCode: string, targetName: string): string;
//# sourceMappingURL=details-context.d.ts.map