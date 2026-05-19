/**
 * generate all サブコマンド - 全ドキュメント一括生成
 *
 * 旧 generate.ts の generateCommand() を移植。
 * `generate`（引数なし）のデフォルト実行先。
 */
interface GenerateAllOptions {
    project: string;
    config: string;
    output?: string;
    withGithub?: boolean;
    verbose?: boolean;
}
/**
 * generate all コマンドハンドラ
 */
export declare function cmdGenerateAll(options: GenerateAllOptions): Promise<number>;
export {};
//# sourceMappingURL=all.d.ts.map