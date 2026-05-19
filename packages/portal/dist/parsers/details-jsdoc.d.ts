/**
 * details-jsdoc - JSDoc解析・コードフォーマット
 *
 * 詳細ページ用のJSDoc解析、コード整形、マークダウン変換を行う。
 */
import type { ParsedJSDoc, DetailJsonItem } from "../commands/details-types.js";
/**
 * JSDocを整形
 *
 * 行頭のインデントを保持しつつ、JSDocの * を除去する
 */
export declare function cleanJSDoc(jsDoc: string): string;
/**
 * コードをエスケープ（highlight.js はCDNから読み込み）
 */
export declare function formatCode(code: string): string;
/**
 * 簡易マークダウン変換（コードブロック対応）
 */
export declare function simpleMarkdown(text: string): string;
/**
 * JSDocコメントを抽出（共通パーサー使用）
 *
 * 関数宣言の位置を先に特定し、その直前にあるJSDocコメントを抽出する。
 */
export declare function extractJSDoc(sourceCode: string, targetName: string): string;
/**
 * JSDocをパースして構造化データにする
 */
export declare function parseJSDoc(jsDoc: string): ParsedJSDoc;
/**
 * JSDocをパースしてJSON出力用の構造化データにする
 */
export declare function parseJSDocForJson(jsDoc: string): DetailJsonItem["jsDoc"];
/**
 * 型定義のソースコードをJSDoc部分と定義部分に分離
 */
export declare function splitTypeSourceCode(sourceCode: string): {
    jsdocHtml: string;
    definitionCode: string;
};
//# sourceMappingURL=details-jsdoc.d.ts.map