/**
 * i18n コマンド - 翻訳ファイルドキュメント生成
 *
 * @description
 * Next.js/next-intl のメッセージファイル (messages/{locale}/*.json) をスキャンし、
 * 翻訳キーのドキュメントを生成する。
 *
 * 機能:
 * - 各 namespace (ファイル名) ごとの翻訳キー一覧
 * - 言語間の翻訳比較テーブル
 * - 不足キーの検出
 * - 翻訳カバレッジ統計
 */
/**
 * コマンドオプション
 */
interface I18nOptions {
    project: string;
    config: string;
    output?: string;
    verbose?: boolean;
}
/**
 * 翻訳キーエントリ
 */
interface TranslationEntry {
    /** キー (ネストキーはドット区切り) */
    key: string;
    /** 各言語の翻訳値 */
    values: Record<string, string | undefined>;
}
/**
 * Namespace (翻訳ファイル) 情報
 */
export interface I18nNamespace {
    /** namespace 名 (ファイル名から拡張子を除いたもの) */
    name: string;
    /** アプリ名 (apps/admin, apps/public など) */
    app?: string;
    /** 説明 (最初のキーの値などから推論) */
    description?: string;
    /** 翻訳エントリ一覧 */
    entries: TranslationEntry[];
    /** 統計情報 */
    stats: {
        /** 総キー数 */
        totalKeys: number;
        /** 各言語のキー数 */
        keysByLocale: Record<string, number>;
        /** 完全に翻訳されているキー数 */
        fullyTranslatedKeys: number;
        /** 不足キー数 */
        missingKeys: number;
    };
}
/**
 * i18n アプリ情報
 */
export interface I18nApp {
    /** アプリID (admin, public, web など) */
    id: string;
    /** 表示名 */
    name: string;
    /** アイコン名 */
    icon: string;
    /** カラー */
    color: string;
    /** namespace 数 */
    namespaceCount: number;
    /** キー数 */
    keyCount: number;
}
/**
 * i18n ドキュメント全体構造
 */
export interface I18nDocumentation {
    /** 検出された言語一覧 */
    locales: string[];
    /** プライマリ言語 (最初に検出された言語) */
    primaryLocale: string;
    /** 検出されたアプリ一覧 */
    apps: I18nApp[];
    /** namespace 一覧 */
    namespaces: I18nNamespace[];
    /** 全体統計 */
    stats: {
        /** 総 namespace 数 */
        totalNamespaces: number;
        /** 総キー数 */
        totalKeys: number;
        /** 翻訳カバレッジ (%) */
        coveragePercent: number;
    };
    /** 生成日時 */
    generatedAt: string;
}
/**
 * i18n コマンドハンドラ
 */
export declare function i18nCommand(options: I18nOptions): number;
export {};
//# sourceMappingURL=i18n.d.ts.map