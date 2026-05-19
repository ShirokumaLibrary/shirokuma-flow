/**
 * Link Checker
 *
 * Markdown 内部リンクの抽出と検証
 */
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
/**
 * Markdown からリンクを抽出する
 */
export function extractLinks(content) {
    const links = [];
    const lines = content.split("\n");
    // Markdown リンクパターン: [text](url) または ![text](url)
    const linkPattern = /!?\[([^\]]*)\]\(([^)]+)\)/g;
    // 参照形式リンクの定義パターン: [ref]: url
    const refPattern = /^\[([^\]]+)\]:\s*(.+)$/;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;
        // 通常のリンク
        let match;
        while ((match = linkPattern.exec(line)) !== null) {
            links.push({
                text: match[1],
                url: match[2],
                line: lineNumber,
            });
        }
        // 参照形式リンク定義
        const refMatch = line.match(refPattern);
        if (refMatch) {
            links.push({
                text: refMatch[1],
                url: refMatch[2],
                line: lineNumber,
            });
        }
    }
    return links;
}
/**
 * リンクの種類を分類する
 */
export function classifyLink(url) {
    // 外部リンク (http/https/mailto)
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:")) {
        return "external";
    }
    // アンカーリンク
    if (url.startsWith("#")) {
        return "anchor";
    }
    // 絶対パスリンク
    if (url.startsWith("/")) {
        return "absolute";
    }
    // 相対パスリンク
    return "relative";
}
/**
 * 相対パスを解決する
 */
export function resolveRelativePath(linkUrl, sourceFile, _basePath) {
    // アンカー部分を除去
    const urlWithoutAnchor = linkUrl.split("#")[0];
    if (!urlWithoutAnchor) {
        // アンカーのみのリンク
        return sourceFile;
    }
    // ソースファイルのディレクトリ
    const sourceDir = dirname(sourceFile);
    // 相対パスを解決
    return resolve(sourceDir, urlWithoutAnchor);
}
/**
 * 内部リンクを検証する
 */
export function validateInternalLink(link, basePath, sourceFile) {
    const linkType = classifyLink(link.url);
    // 外部リンクはスキップ
    if (linkType === "external") {
        return { valid: true, skipped: true };
    }
    // アンカーリンクはスキップ（同一ファイル内の参照）
    if (linkType === "anchor") {
        return { valid: true };
    }
    // パスを解決
    let targetPath;
    if (linkType === "absolute") {
        targetPath = join(basePath, link.url);
    }
    else {
        targetPath = resolveRelativePath(link.url, sourceFile, basePath);
    }
    // アンカー部分を除去
    const pathWithoutAnchor = targetPath.split("#")[0];
    // ファイル存在チェック
    if (!existsSync(pathWithoutAnchor)) {
        return {
            valid: false,
            error: `Broken link: "${link.url}" (target not found: ${pathWithoutAnchor})`,
        };
    }
    return { valid: true };
}
//# sourceMappingURL=link-checker.js.map