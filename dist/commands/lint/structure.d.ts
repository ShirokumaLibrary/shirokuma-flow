/**
 * lint-structure コマンド - プロジェクト構造検証
 *
 * Next.js/TypeScript プロジェクトのディレクトリ構造を検証
 *
 * 検証ルール:
 * - dir-required: 必須ディレクトリの存在
 * - file-required: 必須ファイルの存在
 * - lib-no-root-files: lib/ 直下のファイル禁止
 * - lib-has-index: lib/ サブディレクトリに index.ts 必須
 * - dir-recommended: 推奨ディレクトリの存在
 * - naming-convention: 命名規則
 * - no-cross-app-import: アプリ間インポート禁止
 * - actions-structure: lib/actions/ の crud/domain 構造
 * - components-domain-grouping: components/ ドメイン別グループ化
 * - lib-structure-compliance: lib/ 構造準拠（許可ディレクトリのみ）
 * - barrel-export-required: バレルエクスポート必須
 * - actions-separation: actions/ の crud/domain 分離
 *
 * @module commands/lint-structure
 */
/**
 * コマンドオプション
 */
interface LintStructureOptions {
    project: string;
    config: string;
    format?: "yaml" | "json" | "terminal";
    output?: string;
    strict?: boolean;
    verbose?: boolean;
}
/**
 * lint-structure コマンドハンドラ
 */
export declare function lintStructureCommand(options: LintStructureOptions): number;
export {};
//# sourceMappingURL=structure.d.ts.map