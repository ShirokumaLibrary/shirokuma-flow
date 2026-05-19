/**
 * feature-map 共有ユーティリティ
 *
 * feature-map-tags.ts と feature-map-type-extraction.ts の
 * 両方から使用される共有ユーティリティ関数。
 * 循環依存を回避するために独立ファイルとして分離。
 */
/**
 * JSDoc からタグを抽出
 */
export declare function extractTags(jsdocBlock: string): Record<string, string | undefined>;
/**
 * JSDoc から説明文を抽出 (タグ以外の行)
 */
export declare function extractDescription(jsdocBlock: string): string | undefined;
/**
 * カンマ区切りリストを解析
 */
export declare function parseCommaSeparatedList(value: string | undefined): string[];
/**
 * ファイルパスからモジュール名を抽出
 *
 * @description ファイルパスから意味のあるモジュール名を抽出する。
 * 例:
 *   - "apps/web/lib/actions/members.ts" → "members"
 *   - "apps/web/components/ui/button.tsx" → "ui"
 *   - "apps/web/app/[locale]/(dashboard)/page.tsx" → "dashboard"
 *   - "packages/database/src/schema/users.ts" → "schema"
 *
 * @param filePath - ファイルパス
 * @returns モジュール名
 */
export declare function extractModuleName(filePath: string): string;
//# sourceMappingURL=feature-map-utils.d.ts.map