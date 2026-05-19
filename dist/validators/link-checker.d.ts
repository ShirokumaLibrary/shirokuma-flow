/**
 * Link Checker
 *
 * Markdown 内部リンクの抽出と検証
 */
/**
 * リンク情報
 */
export interface LinkInfo {
    /** リンクテキスト */
    text: string;
    /** リンクURL */
    url: string;
    /** 行番号 */
    line: number;
}
/**
 * リンクの種類
 */
export type LinkType = "external" | "relative" | "absolute" | "anchor";
/**
 * リンク検証結果
 */
export interface LinkValidationResult {
    /** 有効か */
    valid: boolean;
    /** エラーメッセージ */
    error?: string;
    /** スキップされたか */
    skipped?: boolean;
}
/**
 * Markdown からリンクを抽出する
 */
export declare function extractLinks(content: string): LinkInfo[];
/**
 * リンクの種類を分類する
 */
export declare function classifyLink(url: string): LinkType;
/**
 * 相対パスを解決する
 */
export declare function resolveRelativePath(linkUrl: string, sourceFile: string, _basePath: string): string;
/**
 * 内部リンクを検証する
 */
export declare function validateInternalLink(link: LinkInfo, basePath: string, sourceFile: string): LinkValidationResult;
//# sourceMappingURL=link-checker.d.ts.map