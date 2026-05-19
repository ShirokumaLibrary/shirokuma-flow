/**
 * lint-annotations コマンド - アノテーション整合性検証
 *
 * コードアノテーションの整合性を検証:
 * - @usedComponents: インポートとの整合性チェック
 * - @screen: page.tsx での存在チェック
 * - @component: components/*.tsx での存在チェック
 *
 * @module commands/lint-annotations
 */
/**
 * コマンドオプション
 */
interface LintAnnotationsOptions {
    project: string;
    config: string;
    format?: "terminal" | "json" | "summary";
    output?: string;
    strict?: boolean;
    verbose?: boolean;
    fix?: boolean;
}
/**
 * lint-annotations コマンドハンドラ
 */
export declare function lintAnnotationsCommand(options: LintAnnotationsOptions): number;
export {};
//# sourceMappingURL=annotations.d.ts.map