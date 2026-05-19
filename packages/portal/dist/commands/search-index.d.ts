/**
 * search-index コマンド - 検索インデックス生成
 *
 * ドキュメントポータル用の全文検索インデックスを生成する。
 * FlexSearch で利用可能な JSON ファイルを出力する。
 */
import { type ShirokumaConfig } from "../utils/config.js";
import { createLogger } from "../utils/logger.js";
/**
 * コマンドオプション
 */
interface SearchIndexOptions {
    project: string;
    config: string;
    output?: string;
    verbose?: boolean;
}
/**
 * 検索ドキュメント
 */
export interface SearchDocument {
    /** ユニークID */
    id: string;
    /** ドキュメントタイトル */
    title: string;
    /** 検索対象コンテンツ */
    content: string;
    /** ドキュメントへのURL */
    url: string;
    /** ドキュメントタイプ */
    type: "testcase" | "api" | "adr" | "markdown";
    /** カテゴリ (オプション) */
    category?: string;
}
/**
 * 検索インデックス
 */
export interface SearchIndex {
    /** バージョン */
    version: string;
    /** 生成日時 */
    generatedAt: string;
    /** ドキュメント配列 */
    documents: SearchDocument[];
}
/**
 * テキストを正規化
 * - 小文字変換
 * - 余分な空白を削除
 */
export declare function normalizeText(text: string): string;
/**
 * テキストをトークン化
 * - 英語: 単語分割
 * - 日本語: N-gram (bigram)
 */
export declare function tokenize(text: string): string[];
/**
 * テストケースコンテンツからSearchDocumentを抽出
 */
export declare function extractTestCaseDocuments(content: string, file: string, baseUrl: string): SearchDocument[];
/**
 * Markdownコンテンツから SearchDocument を抽出
 */
export declare function extractMarkdownDocuments(content: string, file: string, url: string): SearchDocument[];
/**
 * API ドキュメントから SearchDocument を抽出
 */
export declare function extractApiDocuments(content: string, file: string, url: string): SearchDocument[];
/**
 * 検索インデックスを構築
 */
export declare function buildSearchIndex(documents: SearchDocument[]): SearchIndex;
/**
 * 設定に基づいてドキュメントを抽出
 */
export declare function extractSearchDocuments(projectPath: string, config: ShirokumaConfig, logger: ReturnType<typeof createLogger>): Promise<SearchDocument[]>;
/**
 * search-index コマンドハンドラ
 */
export declare function searchIndexCommand(options: SearchIndexOptions): Promise<number>;
export {};
//# sourceMappingURL=search-index.d.ts.map