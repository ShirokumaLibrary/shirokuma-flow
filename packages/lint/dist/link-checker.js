import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
export function extractLinks(content) {
    const links = [];
    const lines = content.split('\n');
    const linkPattern = /!?\[([^\]]*)\]\(([^)]+)\)/g;
    const refPattern = /^\[([^\]]+)\]:\s*(.+)$/;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const lineNumber = i + 1;
        let match;
        while ((match = linkPattern.exec(line)) !== null) {
            const text = match[1] ?? '';
            const url = match[2];
            if (url !== undefined)
                links.push({ text, url, line: lineNumber });
        }
        const refMatch = line.match(refPattern);
        if (refMatch?.[1] && refMatch[2]) {
            links.push({ text: refMatch[1], url: refMatch[2], line: lineNumber });
        }
    }
    return links;
}
export function classifyLink(url) {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
        return 'external';
    }
    if (url.startsWith('#'))
        return 'anchor';
    if (url.startsWith('/'))
        return 'absolute';
    return 'relative';
}
export function resolveRelativePath(linkUrl, sourceFile) {
    const urlWithoutAnchor = linkUrl.split('#')[0];
    if (!urlWithoutAnchor)
        return sourceFile;
    return resolve(dirname(sourceFile), urlWithoutAnchor);
}
export function validateInternalLink(link, basePath, sourceFile) {
    const linkType = classifyLink(link.url);
    if (linkType === 'external')
        return { valid: true, skipped: true };
    if (linkType === 'anchor')
        return { valid: true };
    const targetPath = linkType === 'absolute' ? join(basePath, link.url) : resolveRelativePath(link.url, sourceFile);
    const pathWithoutAnchor = targetPath.split('#')[0] ?? targetPath;
    if (!existsSync(pathWithoutAnchor)) {
        return {
            valid: false,
            error: `Broken link: "${link.url}" (target not found: ${pathWithoutAnchor})`,
        };
    }
    return { valid: true };
}
//# sourceMappingURL=link-checker.js.map