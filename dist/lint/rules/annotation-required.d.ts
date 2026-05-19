/**
 * annotation-required rule
 *
 * Requires specific annotations for file patterns:
 * - page.tsx: @screen required
 * - "use server" files: @serverAction required
 * - components/*.tsx: @component recommended
 *
 * @module lint/rules/annotation-required
 */
import type { CodeIssue, CodeIssueSeverity } from "../code-types.js";
/**
 * Annotation Required Rule
 */
export interface AnnotationRequiredRule {
    /** ルールID */
    id: string;
    /** デフォルトの重大度 */
    severity: CodeIssueSeverity;
    /** ルールの説明 */
    description: string;
    /**
     * ファイルコンテンツをチェック
     *
     * @param content ファイルのコンテンツ
     * @param filePath ファイルパス
     * @returns 検出された問題の配列
     */
    check(content: string, filePath: string): CodeIssue[];
}
/**
 * 必須アノテーション検出ルール
 */
export declare const annotationRequiredRule: AnnotationRequiredRule;
//# sourceMappingURL=annotation-required.d.ts.map