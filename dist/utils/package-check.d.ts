/**
 * パッケージ・バイナリ存在確認ユーティリティ
 *
 * 外部コマンド（npm list, which）を Node.js ネイティブ API で置換する。
 */
/**
 * 指定パッケージがプロジェクトの node_modules にインストールされているか確認
 *
 * pnpm のシンボリックリンク構造でも existsSync 経由で検出可能。
 * スコープ付きパッケージ（@scope/name）にも対応。
 *
 * @param projectPath - プロジェクトルートパス
 * @param packageName - パッケージ名（例: "typedoc", "@softwaretechnik/dbml-renderer"）
 */
export declare function isPackageInstalled(projectPath: string, packageName: string): boolean;
/**
 * 指定バイナリが PATH 上に存在するか確認
 *
 * process.env.PATH を分割し、各ディレクトリで実行可能ファイルを探索する。
 *
 * @param name - バイナリ名（例: "dbml-renderer", "dot"）
 */
export declare function isBinaryInPath(name: string): boolean;
/**
 * プロジェクトの node_modules/.bin にバイナリが存在するか確認
 *
 * npx 経由でのバージョン確認（npx typedoc --version 等）の代替。
 *
 * @param projectPath - プロジェクトルートパス
 * @param binName - バイナリ名（例: "typedoc"）
 */
export declare function isLocalBinAvailable(projectPath: string, binName: string): boolean;
//# sourceMappingURL=package-check.d.ts.map