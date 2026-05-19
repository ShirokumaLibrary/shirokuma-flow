/**
 * lint-code 用型定義
 *
 * TypeScript コード（Server Actions等）の検証に使用する型
 */
/**
 * 結果をマージ
 */
export function mergeCodeResults(...results) {
    const errors = [];
    const warnings = [];
    const infos = [];
    for (const result of results) {
        errors.push(...result.errors);
        warnings.push(...result.warnings);
        infos.push(...result.infos);
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        infos,
    };
}
//# sourceMappingURL=code-types.js.map