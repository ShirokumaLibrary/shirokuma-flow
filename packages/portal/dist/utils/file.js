/**
 * ファイル操作ユーティリティ
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, renameSync, copyFileSync, unlinkSync, } from "node:fs";
import { resolve, dirname, relative, extname } from "node:path";
import { glob } from "glob";
/**
 * ディレクトリを作成 (再帰的)
 */
export function ensureDir(dirPath) {
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
    }
}
/**
 * ファイルを書き込み (ディレクトリも作成)
 */
export function writeFile(filePath, content) {
    ensureDir(dirname(filePath));
    writeFileSync(filePath, content, "utf-8");
}
/**
 * ファイルを読み込み
 */
export function readFile(filePath) {
    if (!existsSync(filePath)) {
        return null;
    }
    return readFileSync(filePath, "utf-8");
}
/**
 * ファイル一覧を取得 (glob パターン)
 */
export async function findFiles(basePath, pattern, options) {
    const files = await glob(pattern, {
        cwd: basePath,
        absolute: true,
        nodir: true, // ディレクトリを除外
        ignore: options?.ignore || ["**/node_modules/**"],
    });
    return files;
}
/**
 * ディレクトリ内のファイル一覧を取得 (再帰的)
 */
export function listFiles(dirPath, options) {
    const result = [];
    if (!existsSync(dirPath)) {
        return result;
    }
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = resolve(dirPath, entry.name);
        // 無視パターンチェック
        if (options?.ignore?.some((pattern) => fullPath.includes(pattern))) {
            continue;
        }
        if (entry.isDirectory()) {
            if (options?.recursive !== false) {
                result.push(...listFiles(fullPath, options));
            }
        }
        else if (entry.isFile()) {
            // 拡張子フィルタ
            if (options?.extensions) {
                const ext = extname(entry.name);
                if (!options.extensions.includes(ext)) {
                    continue;
                }
            }
            result.push(fullPath);
        }
    }
    return result;
}
/**
 * ファイルの相対パスを取得
 */
export function getRelativePath(from, to) {
    return relative(from, to);
}
/**
 * ファイルが存在するか確認
 */
export function fileExists(filePath) {
    return existsSync(filePath);
}
/**
 * ディレクトリが存在するか確認
 */
export function dirExists(dirPath) {
    return existsSync(dirPath) && statSync(dirPath).isDirectory();
}
/**
 * ファイルを移動（リネーム）する
 *
 * 移動先ディレクトリが存在しない場合は再帰的に作成する。
 * ファイルシステム境界を越える場合（/tmp → プロジェクト等）は
 * copyFileSync + unlinkSync にフォールバックする。
 *
 * @param srcPath - 移動元ファイルパス
 * @param destPath - 移動先ファイルパス
 */
export function moveFile(srcPath, destPath) {
    ensureDir(dirname(destPath));
    try {
        renameSync(srcPath, destPath);
    }
    catch (err) {
        if (err.code === "EXDEV") {
            copyFileSync(srcPath, destPath);
            unlinkSync(srcPath);
        }
        else {
            throw err;
        }
    }
}
/**
 * ファイルの最終更新日時を取得
 */
export function getFileMtime(filePath) {
    if (!existsSync(filePath)) {
        return null;
    }
    return statSync(filePath).mtime;
}
//# sourceMappingURL=file.js.map