const HTTP_PREFIX = /^https?:\/\//;
/**
 * Markdown ファイル内の画像 URL を抽出する（Markdown 記法と `<img>` タグの両対応）。
 * クエリ文字列を除いたファイル名部分に拡張子が含まれるもののみ返す。
 * 順序は元の出現順、重複は除去（両記法で同じ URL path を参照した場合も 1 件に集約）。
 */
export function extractImageUrls(content) {
    const urls = [];
    const seen = new Set();
    const emit = (raw) => {
        if (!raw || !HTTP_PREFIX.test(raw))
            return;
        const canonical = raw.split('?')[0] ?? raw;
        if (seen.has(canonical) || !hasExtension(canonical))
            return;
        seen.add(canonical);
        urls.push(raw);
    };
    const imgRegex = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
    for (const match of content.matchAll(imgRegex))
        emit(match[1]);
    const srcRegex = /<img\s[^>]*src=["']([^"']+)["']/gi;
    for (const match of content.matchAll(srcRegex))
        emit(match[1]);
    return urls;
}
function hasExtension(url) {
    const idx = url.lastIndexOf('/');
    const name = idx >= 0 ? url.slice(idx + 1) : url;
    return name.includes('.');
}
/**
 * Markdown 本文中の絶対 URL 画像参照を `./{localName}` 形式の相対参照に置換する。
 * 複数のマッピングを連続適用する（単純な文字列置換、regex meta は意識しない）。
 */
export function rewriteImagePaths(content, rewrites) {
    let result = content;
    for (const [originalUrl, localName] of rewrites) {
        result = result.split(originalUrl).join(`./${localName}`);
    }
    return result;
}
//# sourceMappingURL=images.js.map