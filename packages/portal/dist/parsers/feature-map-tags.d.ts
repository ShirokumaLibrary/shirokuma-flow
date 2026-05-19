/**
 * feature-map JSDoc タグパーサー
 *
 * TypeScript ファイルから feature-map 用のカスタム JSDoc タグを解析し、
 * FeatureMapItem に変換する。
 */
import type { FeatureMapItem, FileMetadata, ParseResult } from "../commands/feature-map-types.js";
/**
 * ファイルヘッダー領域の終了位置を検出
 *
 * @description
 * ファイルヘッダー領域とは、以下のいずれかが最初に現れるまでの領域:
 * - "use server" または "use client" ディレクティブ
 * - import 文
 * - export 文
 * - 通常の関数/変数宣言
 *
 * ファイルヘッダー内のJSDocコメントは、モジュール全体のドキュメントとして扱い、
 * 個別のアイテム（Screen/Component/Action）として抽出しない。
 *
 * @param content - ファイル内容
 * @returns ヘッダー領域の終了位置（インデックス）
 */
export declare function findCodeStartIndex(content: string): number;
/**
 * ファイルヘッダーからメタデータを抽出
 */
export declare function extractFileMetadata(content: string, codeStartIndex: number): FileMetadata;
/**
 * ファイルから Feature Map タグを解析
 */
export declare function parseFeatureMapTags(content: string, filePath: string): FeatureMapItem[];
/**
 * ファイルから Feature Map タグを解析（メタデータ付き）
 */
export declare function parseFeatureMapTagsWithMetadata(content: string, filePath: string): ParseResult;
/**
 * コメント後のコードからアイテム名を抽出
 */
export declare function extractItemName(code: string): string | undefined;
/**
 * JSDoc ブロックを解析（ファイルメタデータ継承版）
 */
export declare function parseJSDocBlock(jsdocBlock: string, filePath: string, defaultName: string | undefined, fileMetadata: FileMetadata): FeatureMapItem | null;
//# sourceMappingURL=feature-map-tags.d.ts.map