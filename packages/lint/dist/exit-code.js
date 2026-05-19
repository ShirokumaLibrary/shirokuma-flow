export function determineLintExitCode(passed, strict) {
    if (passed)
        return 0;
    return strict ? 1 : 0;
}
export function setExitCode(code) {
    if (code !== 0)
        process.exitCode = code;
}
export function isEnoent(err) {
    return typeof err === 'object' && err !== null && err.code === 'ENOENT';
}
//# sourceMappingURL=exit-code.js.map