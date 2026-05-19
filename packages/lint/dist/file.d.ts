export declare function ensureDir(dirPath: string): void;
export declare function writeFile(filePath: string, content: string): void;
export declare function readFile(filePath: string): string | null;
export declare function fileExists(filePath: string): boolean;
export declare function dirExists(dirPath: string): boolean;
export declare function getFileMtime(filePath: string): Date | null;
export interface ListFilesOptions {
    extensions?: string[];
    recursive?: boolean;
    ignore?: string[];
}
/**
 * glob パターン（`**`, `?` 等）は未サポート。拡張子フィルタと ignore 部分一致のみ。
 */
export declare function listFiles(dirPath: string, options?: ListFilesOptions): string[];
//# sourceMappingURL=file.d.ts.map