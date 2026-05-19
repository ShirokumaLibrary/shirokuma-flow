/**
 * server-action-structure ルール
 *
 * Server Action が以下の順序を守っているか検証:
 * 1. verifyAuth() または verifyAuthMutation() が最初
 * 2. CSRF検証（mutation時）
 * 3. Zodスキーマによる入力検証
 *
 * @module lint/rules/server-action-structure
 */
import type { CodeIssue, CodeIssueSeverity } from "../code-types.js";
/**
 * Server Action Structure Rule
 */
export interface ServerActionStructureRule {
    /** ルールID */
    id: string;
    /** デフォルトの重大度 */
    severity: CodeIssueSeverity;
    /** ルールの説明 */
    description: string;
    /**
     * ファイルコンテンツと関数をチェック
     *
     * @param content ファイル全体のコンテンツ
     * @param filePath ファイルパス
     * @param functionName チェック対象の関数名
     * @param functionLine 関数の行番号
     * @returns 検出された問題の配列
     */
    check(content: string, filePath: string, functionName: string, functionLine: number): CodeIssue[];
}
/**
 * Server Action 構造検証ルール
 */
export declare const serverActionStructureRule: ServerActionStructureRule;
//# sourceMappingURL=server-action-structure.d.ts.map