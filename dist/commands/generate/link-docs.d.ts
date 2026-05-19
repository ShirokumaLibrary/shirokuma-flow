/**
 * link-docs コマンド - API-テスト関連付け機能
 *
 * lint-coverage のデータを活用し、実装ファイルとテストファイルを
 * 双方向にリンクする統合ビューを生成する
 */
/**
 * コマンドオプション
 */
interface LinkDocsOptions {
    project: string;
    config: string;
    output?: string;
    verbose?: boolean;
}
/**
 * link-docs コマンドハンドラ
 */
export declare function linkDocsCommand(options: LinkDocsOptions): Promise<number>;
export {};
//# sourceMappingURL=link-docs.d.ts.map