/**
 * feature-map 型・ユーティリティ抽出
 *
 * TypeScript ソースコードからエクスポートされた型定義
 * （interface, type, enum）とユーティリティ（定数, 関数）を抽出する。
 */
import type { TypeItem, UtilityItem } from "../commands/feature-map-types.js";
/**
 * エクスポートされた型定義を抽出
 */
export declare function extractExportedTypes(content: string): TypeItem[];
/**
 * ブレースで囲まれたブロックを抽出（ネスト対応）
 *
 * @param content - ソースコード全体
 * @param startIndex - 開始ブレース '{' の位置
 * @returns ブレース含む完全なブロック、または null
 */
export declare function extractBracedBlock(content: string, startIndex: number): string | null;
/**
 * 直前のJSDocコメントを抽出
 *
 * @description 宣言の直前（空白のみ許容）にあるJSDocコメントを検出し、
 * JSDocとソースコードを結合して返す。
 * ファイルヘッダーやインポート文の後のJSDocは除外する。
 */
export declare function extractPrecedingJSDoc(content: string, matchIndex: number, matchText: string): {
    jsdoc: string | null;
    sourceCode: string;
};
/**
 * インターフェースのフィールドを抽出
 */
export declare function extractInterfaceFields(body: string): {
    name: string;
    type: string;
    description?: string;
}[];
/**
 * enumの値を抽出
 */
export declare function extractEnumValues(body: string): string[];
/**
 * エクスポートされたユーティリティ（定数・ヘルパー関数）を抽出
 *
 * @description
 * - export const NAME = ... 形式の定数
 * - export function name(...) 形式の関数（@serverAction タグがないもの）
 * を抽出する。
 *
 * @param content - ファイル内容
 * @returns ユーティリティアイテムの配列
 */
export declare function extractExportedUtilities(content: string): UtilityItem[];
/**
 * 関数の引数文字列をパースする
 */
export declare function parseParams(paramsStr: string): {
    name: string;
    type: string;
}[];
//# sourceMappingURL=feature-map-type-extraction.d.ts.map