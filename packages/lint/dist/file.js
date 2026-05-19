import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
export function ensureDir(dirPath) {
    mkdirSync(dirPath, { recursive: true });
}
export function writeFile(filePath, content) {
    ensureDir(dirname(filePath));
    writeFileSync(filePath, content, 'utf-8');
}
export function readFile(filePath) {
    try {
        return readFileSync(filePath, 'utf-8');
    }
    catch (err) {
        if (err instanceof Error && 'code' in err && err.code === 'ENOENT')
            return null;
        throw err;
    }
}
export function fileExists(filePath) {
    return statSync(filePath, { throwIfNoEntry: false })?.isFile() ?? false;
}
export function dirExists(dirPath) {
    return statSync(dirPath, { throwIfNoEntry: false })?.isDirectory() ?? false;
}
export function getFileMtime(filePath) {
    return statSync(filePath, { throwIfNoEntry: false })?.mtime ?? null;
}
/**
 * glob パターン（`**`, `?` 等）は未サポート。拡張子フィルタと ignore 部分一致のみ。
 */
export function listFiles(dirPath, options) {
    if (!dirExists(dirPath))
        return [];
    const result = [];
    const recursive = options?.recursive ?? true;
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = resolve(dirPath, entry.name);
        if (options?.ignore?.some((pattern) => fullPath.includes(pattern)))
            continue;
        if (entry.isDirectory()) {
            if (recursive)
                result.push(...listFiles(fullPath, options));
        }
        else if (entry.isFile()) {
            if (options?.extensions && !options.extensions.includes(extname(entry.name)))
                continue;
            result.push(fullPath);
        }
    }
    return result;
}
//# sourceMappingURL=file.js.map