/**
 * アノテーション整合性検証ロジック
 *
 * コードアノテーション（@usedComponents, @screen, @component等）の
 * 整合性を検証するユーティリティ関数群
 *
 * @module lint/annotation-lint
 */
import type { UsedComponentsResult, AnnotationCheckResult, ExtractImportsOptions, AnnotationCheckOptions } from "./annotation-types.js";
export type { UsedComponentsResult, AnnotationCheckResult };
/**
 * 修正結果の型
 */
export interface FixResult {
    /** ファイル内容が変更されたか */
    changed: boolean;
    /** 修正後のファイル内容 */
    content: string;
}
/**
 * 複数修正結果の型
 */
export interface ApplyFixesResult extends FixResult {
    /** 適用された変更のリスト */
    changes: string[];
}
/**
 * 修正オプション
 */
export interface FixOptions {
    /** @usedComponents を修正するか */
    fixUsedComponents?: boolean;
    /** @screen を修正するか */
    fixScreen?: boolean;
    /** @route を修正するか */
    fixRoute?: boolean;
}
/**
 * JSDoc から @usedComponents アノテーションを抽出
 *
 * @param content - ファイル内容
 * @returns コンポーネント名の配列
 *
 * @example
 * ```typescript
 * const components = extractUsedComponentsAnnotation(`
 *   /**
 *    * @usedComponents Button, Card, Dialog
 *    *\/
 *   export function MyComponent() {}
 * `);
 * // Returns: ["Button", "Card", "Dialog"]
 * ```
 */
export declare function extractUsedComponentsAnnotation(content: string): string[];
/**
 * import文からコンポーネント名を抽出
 *
 * components ディレクトリからのインポートのみを対象とする
 *
 * @param content - ファイル内容
 * @param options - 抽出オプション
 * @returns コンポーネント名の配列
 *
 * @example
 * ```typescript
 * const components = extractComponentsFromImports(`
 *   import { Button, Card } from "@/components/ui/button";
 * `, { excludeHooks: true });
 * // Returns: ["Button", "Card"]
 * ```
 */
export declare function extractComponentsFromImports(content: string, options?: ExtractImportsOptions): string[];
/**
 * @usedComponents アノテーションとインポートを比較
 *
 * @param annotated - アノテーションに記載されたコンポーネント
 * @param imported - インポートされているコンポーネント
 * @returns 比較結果
 *
 * @example
 * ```typescript
 * const result = compareUsedComponents(
 *   ["Button", "Card"],
 *   ["Button", "Card", "Dialog"]
 * );
 * // result.missing: ["Dialog"]
 * // result.extra: []
 * // result.valid: false
 * ```
 */
export declare function compareUsedComponents(annotated: string[], imported: string[]): UsedComponentsResult;
/**
 * @screen アノテーションの存在をチェック
 *
 * page.tsx ファイルに @screen アノテーションがあるか確認
 *
 * @param content - ファイル内容
 * @param filePath - ファイルパス
 * @param options - チェックオプション
 * @returns チェック結果
 *
 * @example
 * ```typescript
 * const result = checkScreenAnnotation(
 *   content,
 *   "app/[locale]/dashboard/page.tsx",
 *   { exclude: ["*\/not-found.tsx"] }
 * );
 * ```
 */
export declare function checkScreenAnnotation(content: string, filePath: string, options?: AnnotationCheckOptions): AnnotationCheckResult;
/**
 * @component アノテーションの存在をチェック
 *
 * コンポーネントファイルに @component アノテーションがあるか確認
 *
 * @param content - ファイル内容
 * @param filePath - ファイルパス
 * @param options - チェックオプション
 * @returns チェック結果
 *
 * @example
 * ```typescript
 * const result = checkComponentAnnotation(
 *   content,
 *   "components/project-list.tsx",
 *   { exclude: ["*\/ui\/**"] }
 * );
 * ```
 */
export declare function checkComponentAnnotation(content: string, filePath: string, options?: AnnotationCheckOptions): AnnotationCheckResult;
/**
 * ファイルパスからスクリーン名を生成
 *
 * @param filePath - ファイルパス
 * @returns スクリーン名 (PascalCase + "Screen")
 *
 * @example
 * ```typescript
 * generateScreenName("app/[locale]/dashboard/page.tsx")
 * // Returns: "DashboardScreen"
 *
 * generateScreenName("app/[locale]/settings/profile/page.tsx")
 * // Returns: "SettingsProfileScreen"
 * ```
 */
export declare function generateScreenName(filePath: string): string;
/**
 * ファイルパスからルートを生成
 *
 * @param filePath - ファイルパス
 * @returns ルートパス
 *
 * @example
 * ```typescript
 * generateRoute("app/[locale]/posts/page.tsx")
 * // Returns: "/posts"
 *
 * generateRoute("app/[locale]/posts/[id]/page.tsx")
 * // Returns: "/posts/[id]"
 * ```
 */
export declare function generateRoute(filePath: string): string;
/**
 * @usedComponents アノテーションを自動修正
 *
 * @param content - ファイル内容
 * @param filePath - ファイルパス (未使用だが将来の拡張用)
 * @returns 修正結果
 */
export declare function fixUsedComponentsAnnotation(content: string, _filePath: string): FixResult;
/**
 * @screen アノテーションを自動修正
 *
 * @param content - ファイル内容
 * @param filePath - ファイルパス
 * @returns 修正結果
 */
export declare function fixScreenAnnotation(content: string, filePath: string): FixResult;
/**
 * @route アノテーションを自動修正
 *
 * @param content - ファイル内容
 * @param filePath - ファイルパス
 * @returns 修正結果
 */
export declare function fixRouteAnnotation(content: string, filePath: string): FixResult;
/**
 * 複数の修正を一度に適用
 *
 * @param content - ファイル内容
 * @param filePath - ファイルパス
 * @param options - 修正オプション
 * @returns 修正結果
 */
export declare function applyFixes(content: string, filePath: string, options: FixOptions): ApplyFixesResult;
//# sourceMappingURL=annotation-lint.d.ts.map