/**
 * 共通 JSDoc パーサー
 *
 * 単行・複数行・リスト形式のタグを統一的に解析する。
 * shirokuma-docs 内の全コマンドで共通利用。
 *
 * @module parsers/jsdoc-common
 */
/**
 * パース結果
 */
export interface JsDocParsed {
    /** 説明文（複数行、段落区切り対応） */
    description: string;
    /** タグ名 -> 値のマップ */
    tags: Map<string, JsDocTagValue>;
    /** 元のJSDocブロック */
    raw: string;
}
/**
 * タグ値の型
 * - string: 単行タグ
 * - string[]: 複数行タグ（行ごと）
 * - JsDocListItem[]: リスト形式タグ
 * - JsDocParamItem[]: パラメータ形式タグ
 */
export type JsDocTagValue = string | string[] | JsDocListItem[] | JsDocParamItem[];
/**
 * リスト形式タグの項目
 * 形式: `- key: value (meta)`
 */
export interface JsDocListItem {
    /** リスト項目のキー（例: "NOT_FOUND", "organizationId"） */
    key: string;
    /** 説明 */
    value: string;
    /** 追加情報（例: "(404)", "(FK -> users.id)"） */
    meta?: string;
}
/**
 * パラメータ形式タグの項目
 * 形式: `@param {type} name - description`
 */
export interface JsDocParamItem {
    /** パラメータ名 */
    name: string;
    /** 説明 */
    description: string;
    /** 型（オプショナル） */
    type?: string;
}
/**
 * タグの種類設定
 */
export declare const TAG_CONFIG: {
    /**
     * 単行タグ: 同じ行で終了
     * 形式: @tag value
     */
    readonly singleLine: Set<string>;
    /**
     * 複数行タグ: 次の@タグまで（プレーンテキスト）
     * 形式: @tag\n * line1\n * line2
     */
    readonly multiLine: Set<string>;
    /**
     * リスト形式タグ: `- key: value` 形式
     * 形式: @tag\n *   - key: value (meta)
     */
    readonly listFormat: Set<string>;
    /**
     * エラーコード形式タグ: `- CODE: description (status)` 形式
     */
    readonly errorCodeFormat: Set<string>;
    /**
     * パラメータ形式タグ: `@param {type} name - description`
     */
    readonly paramFormat: Set<string>;
};
/**
 * JSDocブロックをパースする
 *
 * @param jsDocBlock - JSDocコメント文字列（/** ... *\/ 形式）
 * @returns パース結果
 *
 * @example
 * ```ts
 * const parsed = parseJsDoc(`/**
 *  * ユーザーテーブル
 *  *
 *  * ユーザー情報を管理します。
 *  *
 *  * @dbTable users
 *  * @feature UserManagement
 *  *\/`);
 *
 * console.log(parsed.description);
 * // => "ユーザーテーブル\n\nユーザー情報を管理します。"
 *
 * console.log(getTagValue(parsed, 'dbTable'));
 * // => "users"
 * ```
 */
export declare function parseJsDoc(jsDocBlock: string): JsDocParsed;
/**
 * 単行タグの値を取得
 *
 * @param parsed - パース結果
 * @param tagName - タグ名（@なし）
 * @returns タグ値（存在しない場合は undefined）
 */
export declare function getTagValue(parsed: JsDocParsed, tagName: string): string | undefined;
/**
 * 複数行タグの値を配列として取得
 *
 * @param parsed - パース結果
 * @param tagName - タグ名（@なし）
 * @returns 行配列（タグがない場合は空配列）
 */
export declare function getTagLines(parsed: JsDocParsed, tagName: string): string[];
/**
 * リスト形式タグの項目を取得
 *
 * @param parsed - パース結果
 * @param tagName - タグ名（@なし）
 * @returns リスト項目配列（タグがない場合は空配列）
 */
export declare function getTagItems(parsed: JsDocParsed, tagName: string): JsDocListItem[];
/**
 * パラメータ形式タグの項目を取得
 *
 * @param parsed - パース結果
 * @param tagName - タグ名（@なし、通常は "param" または "throws"）
 * @returns パラメータ項目配列（タグがない場合は空配列）
 */
export declare function getTagParams(parsed: JsDocParsed, tagName: string): JsDocParamItem[];
/**
 * タグが存在するかチェック
 */
export declare function hasTag(parsed: JsDocParsed, tagName: string): boolean;
/**
 * すべてのタグ名を取得
 */
export declare function getTagNames(parsed: JsDocParsed): string[];
/**
 * ファイルヘッダーのJSDocを抽出
 *
 * ファイル先頭にある最初のJSDocブロックを抽出する。
 * page.tsx など、ファイル全体が1つの画面/コンポーネントを表す場合に使用。
 *
 * @param sourceCode - ソースコード全体
 * @returns JSDocブロック（見つからない場合は空文字列）
 */
export declare function extractFileHeaderJsDoc(sourceCode: string): string;
/**
 * ソースコードから指定された名前の直前にあるJSDocを抽出
 *
 * @param sourceCode - ソースコード全体
 * @param targetName - 対象の関数/変数名、または@screen/@componentの値
 * @returns JSDocブロック（見つからない場合は空文字列）
 */
export declare function extractJsDocBefore(sourceCode: string, targetName: string): string;
/**
 * ソースコードからすべてのJSDocを抽出
 *
 * @param sourceCode - ソースコード全体
 * @returns 名前とJSDocのペア配列
 */
export declare function extractAllJsDocs(sourceCode: string): Array<{
    name: string;
    jsDoc: string;
    parsed: JsDocParsed;
}>;
/**
 * DBスキーマファイル用のJSDoc情報
 */
export interface DbSchemaJsDocInfo {
    /** テーブル名 -> 説明 */
    tables: Map<string, string>;
    /** テーブル名 -> (カラム名 -> 説明) */
    columns: Map<string, Map<string, string>>;
    /** テーブル名 -> (インデックス名 -> 説明) */
    indexes: Map<string, Map<string, string>>;
    /** テーブル名 -> パース結果全体 */
    parsed: Map<string, JsDocParsed>;
}
/**
 * Drizzle ORMスキーマファイルからJSDoc情報を抽出
 *
 * @param sourceCode - スキーマファイルの内容
 * @returns DBスキーマJSDoc情報
 */
export declare function extractDbSchemaJsDocs(sourceCode: string): DbSchemaJsDocInfo;
/**
 * ファイル内容から export されたコンポーネント名を抽出
 *
 * 以下のパターンを検出:
 * - export function ComponentName
 * - export default function ComponentName
 * - export const ComponentName = ...
 * - export default ComponentName (at end of file)
 *
 * PascalCase の名前のみをコンポーネントとして扱う
 *
 * @param content - ファイル内容
 * @returns 検出されたコンポーネント名（PascalCaseのもののみ）
 */
export declare function extractExportedComponentName(content: string): string | undefined;
//# sourceMappingURL=jsdoc-common.d.ts.map