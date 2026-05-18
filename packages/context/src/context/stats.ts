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

export function createEmptyStats(): FetchStats {
  return {
    downloaded: 0,
    skipped: 0,
    failed: 0,
    imagesDownloaded: 0,
    imagesSkipped: 0,
    imagesFailed: 0,
    svgConverted: 0,
    svgKept: 0,
  };
}
