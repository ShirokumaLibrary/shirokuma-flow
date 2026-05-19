/**
 * lint all サブコマンド - 全 lint 一括実行
 *
 * `lint`（引数なし）のデフォルト実行先。
 * generate/all.ts とは異なり、lint は品質ゲートの役割を持つため:
 * - --strict 時: 1つでもエラーがあれば exit code 1
 * - --strict なし: サマリーを表示して exit 0
 */
interface LintAllOptions {
    project: string;
    config: string;
    format?: string;
    output?: string;
    strict?: boolean;
    verbose?: boolean;
}
/**
 * lint all コマンドハンドラ
 */
export declare function cmdLintAll(options: LintAllOptions): Promise<number>;
export {};
//# sourceMappingURL=all.d.ts.map