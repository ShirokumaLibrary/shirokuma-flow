/**
 * lint-docs 用型定義
 *
 * 手動ドキュメントの検証に使用する型
 */
/**
 * FileValidationConfig かどうかを判定
 */
export function isFileConfig(config) {
    return "file" in config;
}
/**
 * FilePatternValidationConfig かどうかを判定
 */
export function isPatternConfig(config) {
    return "filePattern" in config;
}
//# sourceMappingURL=docs-types.js.map