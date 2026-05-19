/**
 * items add - 共用ユーティリティ (#1808)
 *
 * 3サブコマンド（comment / issue / discussion）共通で使用するファイル読み込み処理。
 */
/** ファイルから本文と frontmatter メタデータを読み込む */
export declare function readFileWithFrontmatter(filePath: string): {
    body: string;
    meta: Record<string, unknown>;
} | null;
//# sourceMappingURL=shared.d.ts.map