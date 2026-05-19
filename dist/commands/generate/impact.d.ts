/**
 * impact.ts - 変更影響分析コマンド
 *
 * 指定したファイル/アイテムを変更した場合に影響を受ける箇所を分析
 * レビュー時に「この変更で他のどこが影響を受けるか」を把握するのに使用
 */
export interface ImpactOptions {
    output?: string;
    target?: string;
    maxDepth?: number;
    format?: "json" | "html" | "table";
}
export declare function impactCommand(options?: ImpactOptions): number;
//# sourceMappingURL=impact.d.ts.map