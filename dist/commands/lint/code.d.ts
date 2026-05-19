/**
 * lint-code コマンド - TypeScript コード構造検証
 *
 * Server Actions モジュールの JSDoc タグ・構造を機械的にチェック
 *
 * 検証ルール:
 * - server-action-structure: 認証 -> CSRF -> Zod の順序検証
 * - annotation-required: 必須アノテーション検出
 */
/**
 * コマンドオプション
 */
interface LintCodeOptions {
    project: string;
    config: string;
    format?: "terminal" | "json" | "summary";
    output?: string;
    strict?: boolean;
    verbose?: boolean;
}
/**
 * lint-code コマンドハンドラ
 */
export declare function lintCodeCommand(options: LintCodeOptions): number;
export {};
//# sourceMappingURL=code.d.ts.map