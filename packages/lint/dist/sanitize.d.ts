export declare function escapeRegExp(str: string): string;
export declare function safeRegExp(pattern: string, flags?: string): RegExp | null;
/**
 * lint が書き込み前に呼ぶ gate。ホーム配下 / `os.tmpdir()` 配下以外と `/etc` 等の
 * システムパスを弾き、解決済み絶対パスを返す。macOS tmpdir は `/var/folders/...`
 * なので、システム prefix チェックより先に tmp / home 判定を通す。
 */
export declare function validateProjectPath(inputPath: string): string;
//# sourceMappingURL=sanitize.d.ts.map