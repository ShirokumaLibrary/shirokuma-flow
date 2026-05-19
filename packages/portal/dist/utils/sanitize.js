/**
 * sanitize - 入力サニタイズユーティリティ
 *
 * 外部入力を安全に扱うための共通関数群。
 * GitHub search クエリ構築、正規表現パターン構築、
 * ファイルパスのバリデーションで使用。
 */
import { resolve } from "node:path";
import { homedir } from "node:os";
/**
 * ダブルクォートを除去
 *
 * GitHub search の `category:"..."` 等、クォート内に埋め込む値から
 * ダブルクォートを除去し、構文破壊を防ぐ。
 */
export function stripDoubleQuotes(str) {
    return str.replace(/"/g, "");
}
/**
 * 正規表現の特殊文字をエスケープ
 *
 * 外部入力を `new RegExp()` のパターンに埋め込む際に使用。
 */
export function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
 * 安全に RegExp を構築
 *
 * 設定ファイル等から意図的に正規表現パターンを受け取る場合に使用。
 * 無効なパターンの場合は null を返す。
 */
export function safeRegExp(pattern, flags) {
    try {
        return new RegExp(pattern, flags);
    }
    catch {
        return null;
    }
}
/** パストラバーサル対策: アクセスを拒否するシステムディレクトリプレフィックス */
const BLOCKED_SYSTEM_PREFIXES = ["/etc", "/var", "/sys", "/proc", "/dev", "/boot", "/sbin", "/usr/sbin"];
/**
 * プロジェクトパスを検証し、解決済み絶対パスを返す
 *
 * パストラバーサル攻撃を防止するため、システムディレクトリへの
 * アクセスを拒否する。ホームディレクトリ配下と /tmp 配下のパスのみ許可。
 *
 * @param inputPath - 検証するパス（相対パスも可）
 * @returns 解決済み絶対パス
 * @throws {Error} パスが安全でない場合
 */
export function validateProjectPath(inputPath) {
    if (!inputPath) {
        throw new Error("Project path must not be empty");
    }
    const resolved = resolve(inputPath);
    for (const prefix of BLOCKED_SYSTEM_PREFIXES) {
        if (resolved === prefix || resolved.startsWith(prefix + "/")) {
            throw new Error(`Project path "${inputPath}" resolves to system directory "${resolved}". ` +
                `Access to ${prefix} is not allowed for security reasons.`);
        }
    }
    // ルートディレクトリ自体を拒否
    if (resolved === "/") {
        throw new Error(`Project path "${inputPath}" resolves to root directory "/". ` +
            `This is not allowed for security reasons.`);
    }
    // 許可リスト: ホームディレクトリ配下 or /tmp 配下
    const home = homedir();
    const isUnderHome = resolved === home || resolved.startsWith(home + "/");
    const isUnderTmp = resolved === "/tmp" || resolved.startsWith("/tmp/");
    if (!isUnderHome && !isUnderTmp) {
        throw new Error(`Project path "${inputPath}" resolves to "${resolved}" which is outside ` +
            `the allowed directories (home directory or /tmp). ` +
            `This is not allowed for security reasons.`);
    }
    return resolved;
}
//# sourceMappingURL=sanitize.js.map