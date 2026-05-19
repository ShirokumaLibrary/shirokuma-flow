/**
 * Lint 系コマンド共通の exit code 判定ヘルパー
 *
 * passed=true → 0, passed=false && strict → 1, passed=false && !strict → 0
 */
export function determineLintExitCode(passed, strict) {
    if (passed)
        return 0;
    return strict ? 1 : 0;
}
//# sourceMappingURL=exit-code.js.map