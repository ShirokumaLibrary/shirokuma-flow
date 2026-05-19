/**
 * lint-docs コマンド - ドキュメント構造検証
 *
 * 手動ドキュメント（OVERVIEW.md, ADR等）の存在・構造を機械的にチェック
 * 内容の品質チェックは行わない（それはAIの仕事）
 */
/**
 * コマンドオプション
 */
interface LintDocsOptions {
    project: string;
    config: string;
    format?: "terminal" | "json" | "summary";
    output?: string;
    strict?: boolean;
    verbose?: boolean;
}
/**
 * lint-docs コマンドハンドラ
 */
export declare function lintDocsCommand(options: LintDocsOptions): number;
export {};
//# sourceMappingURL=docs.d.ts.map