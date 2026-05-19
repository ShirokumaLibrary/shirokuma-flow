/**
 * DB スキーマユーティリティ
 *
 * portal/lib/db-schema-utils.ts の Node.js 移植版。
 * カテゴリ設定・正規化・推論ロジック。
 */
/** カテゴリ設定（ラベルと CSS クラス）*/
export declare const categoryConfig: Record<string, {
    label: string;
    color: string;
    bgColor: string;
}>;
/**
 * カテゴリ名を正規化する
 */
export declare function normalizeCategory(category: string | undefined): string;
/**
 * テーブル名からカテゴリを推論する
 */
export declare function inferCategory(tableName: string): string;
/**
 * カテゴリ設定を取得する（フォールバック付き）
 */
export declare function getCategoryConfig(category: string): {
    label: string;
    color: string;
    bgColor: string;
};
//# sourceMappingURL=db-schema-utils.d.ts.map