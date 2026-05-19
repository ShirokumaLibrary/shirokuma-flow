/**
 * ポータルジェネレーター（Handlebars ベース）
 *
 * Handlebars テンプレートを使用して静的 HTML ポータルを生成する。
 * Next.js / React 依存を完全に除去したスタンドアロン実装。
 */
/** ポータル生成オプション */
export interface PortalGeneratorOptions {
    /** プロジェクトルートパス */
    projectPath: string;
    /** プロジェクト名 */
    projectName: string;
    /** 出力ディレクトリ（JSON ファイルも格納） */
    outputDir: string;
    /** 詳細ログを有効にするか */
    verbose?: boolean;
}
/**
 * Handlebars ベースのポータルジェネレーター
 */
export declare class PortalGenerator {
    private options;
    private data;
    constructor(options: PortalGeneratorOptions);
    /**
     * ポータルを生成する
     */
    generate(): Promise<void>;
    /**
     * 全ページを生成する
     */
    private buildAllPages;
    /**
     * 検索インデックスを生成して保存する
     */
    private generateSearchIndex;
    /**
     * ページ HTML をファイルシステムに書き出す
     */
    private writePages;
    /**
     * テンプレートの assets/ を出力先にコピーする
     */
    private copyAssets;
    private log;
}
//# sourceMappingURL=index.d.ts.map