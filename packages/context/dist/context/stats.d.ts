/**
 * fetch 系オペレーション全体の進捗カウンタ。preset 実装が in-place で
 * インクリメントし、呼び出し元が最終サマリを表示する。
 */
export interface FetchStats {
    downloaded: number;
    skipped: number;
    failed: number;
    imagesDownloaded: number;
    imagesSkipped: number;
    imagesFailed: number;
    svgConverted: number;
    svgKept: number;
}
export declare function createEmptyStats(): FetchStats;
//# sourceMappingURL=stats.d.ts.map