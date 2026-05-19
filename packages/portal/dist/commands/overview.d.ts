/**
 * overview コマンド - プロジェクト概要ページ生成
 *
 * config とオプションの OVERVIEW.md から、プロジェクトのトップレベル
 * ドキュメントページを生成する
 */
/**
 * コマンドオプション
 */
interface OverviewOptions {
    project: string;
    config: string;
    output?: string;
    verbose?: boolean;
}
/**
 * overview コマンドハンドラ
 */
export declare function overviewCommand(options: OverviewOptions): number;
export {};
//# sourceMappingURL=overview.d.ts.map