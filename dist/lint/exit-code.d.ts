/**
 * Lint 系コマンド共通の exit code 判定ヘルパー
 *
 * passed=true → 0, passed=false && strict → 1, passed=false && !strict → 0
 */
export declare function determineLintExitCode(passed: boolean, strict: boolean): number;
//# sourceMappingURL=exit-code.d.ts.map