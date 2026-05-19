/**
 * 無効なパターンに対し例外を投げず null を返す RegExp ファクトリ。
 *
 * @param pattern - 正規表現パターン文字列
 * @param flags - 正規表現フラグ（省略可）
 */
export function safeRegExp(pattern, flags) {
    try {
        return new RegExp(pattern, flags);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=sanitize.js.map