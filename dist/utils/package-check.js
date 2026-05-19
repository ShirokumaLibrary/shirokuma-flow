/**
 * パッケージ・バイナリ存在確認ユーティリティ
 *
 * 外部コマンド（npm list, which）を Node.js ネイティブ API で置換する。
 */
import { existsSync, accessSync, constants } from "node:fs";
import { join, delimiter } from "node:path";
/**
 * 指定パッケージがプロジェクトの node_modules にインストールされているか確認
 *
 * pnpm のシンボリックリンク構造でも existsSync 経由で検出可能。
 * スコープ付きパッケージ（@scope/name）にも対応。
 *
 * @param projectPath - プロジェクトルートパス
 * @param packageName - パッケージ名（例: "typedoc", "@softwaretechnik/dbml-renderer"）
 */
export function isPackageInstalled(projectPath, packageName) {
    const pkgJsonPath = join(projectPath, "node_modules", packageName, "package.json");
    return existsSync(pkgJsonPath);
}
/**
 * 指定バイナリが PATH 上に存在するか確認
 *
 * process.env.PATH を分割し、各ディレクトリで実行可能ファイルを探索する。
 *
 * @param name - バイナリ名（例: "dbml-renderer", "dot"）
 */
export function isBinaryInPath(name) {
    const pathEnv = process.env.PATH;
    if (!pathEnv)
        return false;
    const dirs = pathEnv.split(delimiter);
    for (const dir of dirs) {
        try {
            const fullPath = join(dir, name);
            accessSync(fullPath, constants.X_OK);
            return true;
        }
        catch {
            // このディレクトリにはバイナリなし、次を試行
        }
    }
    return false;
}
/**
 * プロジェクトの node_modules/.bin にバイナリが存在するか確認
 *
 * npx 経由でのバージョン確認（npx typedoc --version 等）の代替。
 *
 * @param projectPath - プロジェクトルートパス
 * @param binName - バイナリ名（例: "typedoc"）
 */
export function isLocalBinAvailable(projectPath, binName) {
    const binPath = join(projectPath, "node_modules", ".bin", binName);
    try {
        accessSync(binPath, constants.X_OK);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=package-check.js.map