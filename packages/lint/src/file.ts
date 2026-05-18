import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

export function writeFile(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, 'utf-8');
}

export function readFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return null;
    throw err;
  }
}

export function fileExists(filePath: string): boolean {
  return statSync(filePath, { throwIfNoEntry: false })?.isFile() ?? false;
}

export function dirExists(dirPath: string): boolean {
  return statSync(dirPath, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

export function getFileMtime(filePath: string): Date | null {
  return statSync(filePath, { throwIfNoEntry: false })?.mtime ?? null;
}

export interface ListFilesOptions {
  extensions?: string[];
  recursive?: boolean;
  ignore?: string[];
}

/**
 * glob パターン（`**`, `?` 等）は未サポート。拡張子フィルタと ignore 部分一致のみ。
 */
export function listFiles(dirPath: string, options?: ListFilesOptions): string[] {
  if (!dirExists(dirPath)) return [];

  const result: string[] = [];
  const recursive = options?.recursive ?? true;

  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = resolve(dirPath, entry.name);
    if (options?.ignore?.some((pattern) => fullPath.includes(pattern))) continue;

    if (entry.isDirectory()) {
      if (recursive) result.push(...listFiles(fullPath, options));
    } else if (entry.isFile()) {
      if (options?.extensions && !options.extensions.includes(extname(entry.name))) continue;
      result.push(fullPath);
    }
  }
  return result;
}
