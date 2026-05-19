/**
 * ハンドラの戻り値（exit code）を process.exitCode に反映する。
 * 0 以外の場合のみ設定する。
 */
export function setExitCode(code) {
    if (code !== 0)
        process.exitCode = code;
}
//# sourceMappingURL=cli-helpers.js.map