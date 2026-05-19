/**
 * deps コマンド - 依存関係グラフ生成
 *
 * dependency-cruiser を使用してモジュール依存関係グラフを生成する。
 *
 * @example
 * ```bash
 * shirokuma-flow deps --project ./my-project
 * ```
 */
interface DepsOptions {
    project: string;
    config: string;
    output?: string;
    verbose?: boolean;
}
/**
 * deps コマンドハンドラ
 *
 * @param options - コマンドオプション
 */
export declare function depsCommand(options: DepsOptions): Promise<number>;
export {};
//# sourceMappingURL=deps.d.ts.map