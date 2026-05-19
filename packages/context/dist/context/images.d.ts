/**
 * Markdown ファイル内の画像 URL を抽出する（Markdown 記法と `<img>` タグの両対応）。
 * クエリ文字列を除いたファイル名部分に拡張子が含まれるもののみ返す。
 * 順序は元の出現順、重複は除去（両記法で同じ URL path を参照した場合も 1 件に集約）。
 */
export declare function extractImageUrls(content: string): string[];
/**
 * Markdown 本文中の絶対 URL 画像参照を `./{localName}` 形式の相対参照に置換する。
 * 複数のマッピングを連続適用する（単純な文字列置換、regex meta は意識しない）。
 */
export declare function rewriteImagePaths(content: string, rewrites: Map<string, string>): string;
//# sourceMappingURL=images.d.ts.map