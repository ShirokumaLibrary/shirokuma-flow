/**
 * llms.txt の内容からリンク URL だけを抽出する。相対パスは `baseUrl` 起点で
 * 解決される。`parseLlmsTxtWithTitles` の薄いラッパー。
 */
export function parseLlmsTxt(content, baseUrl) {
    return parseLlmsTxtWithTitles(content, baseUrl).map((e) => e.url);
}
/**
 * llms.txt の内容から URL とタイトルのペアを抽出する。
 * full-split 時にセクションへ H1 タイトルを付与するために使用する。
 * `baseUrl` が指定された場合、相対パスリンク (`/foo/bar`) を絶対 URL に解決する。
 *
 * 抽出順:
 *   1. `[title](https?://...)` — 絶対 URL の Markdown リンク
 *   2. `[title](/path)` — baseUrl の origin で絶対化
 *   3. 行頭が `http://` / `https://` の裸 URL 行（title は空）
 * 同じ URL は先勝ち（重複は除去）。
 */
export function parseLlmsTxtWithTitles(content, baseUrl) {
    const entries = [];
    const seen = new Set();
    const origin = baseUrl ? tryParseOrigin(baseUrl) : '';
    const mdLinkAbsRegex = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
    for (const match of content.matchAll(mdLinkAbsRegex)) {
        const title = match[1] ?? '';
        const url = match[2];
        if (url && !seen.has(url)) {
            seen.add(url);
            entries.push({ url, title });
        }
    }
    if (origin) {
        const mdLinkRelRegex = /\[([^\]]*)\]\((\/[^)\s]+)\)/g;
        for (const match of content.matchAll(mdLinkRelRegex)) {
            const title = match[1] ?? '';
            const path = match[2];
            if (!path)
                continue;
            const url = origin + path;
            if (!seen.has(url)) {
                seen.add(url);
                entries.push({ url, title });
            }
        }
    }
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            const url = trimmed.split(/\s/)[0];
            if (url && !seen.has(url)) {
                seen.add(url);
                entries.push({ url, title: '' });
            }
        }
    }
    return entries;
}
/**
 * llms.txt から URL→タイトルの Map を構築する。`full-split` セクションに
 * H1 タイトルを付与するための補助構造。タイトルが空のエントリは無視される。
 */
export function buildTitleMap(llmsContent) {
    const map = new Map();
    for (const { url, title } of parseLlmsTxtWithTitles(llmsContent)) {
        if (title)
            map.set(url, title);
    }
    return map;
}
function tryParseOrigin(url) {
    try {
        return new URL(url).origin;
    }
    catch {
        return '';
    }
}
//# sourceMappingURL=llms-txt.js.map