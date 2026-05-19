/**
 * Lint Types - テストドキュメントのlint用型定義
 */
/**
 * 重大度の順序 (小さいほど重大)
 */
export const severityOrder = {
    error: 0,
    warning: 1,
    info: 2,
};
/**
 * 日本語を含むかどうか判定
 *
 * ひらがな、カタカナ、漢字を検出
 */
export function containsJapanese(text) {
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japaneseRegex.test(text);
}
//# sourceMappingURL=types.js.map