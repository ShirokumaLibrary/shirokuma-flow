/**
 * `console` にそのまま書き出す既定 logger。verbose=true なら debug も出す。
 * 色付けや step 表示が必要な場合は consumer 側が独自の `Logger` を渡す。
 */
export function createConsoleLogger(verbose = false) {
    return {
        info: (m) => console.log(`[info] ${m}`),
        warn: (m) => console.log(`[warn] ${m}`),
        error: (m) => console.error(`[error] ${m}`),
        debug: (m) => {
            if (verbose)
                console.log(`[debug] ${m}`);
        },
    };
}
/**
 * Logger 未指定時にどこでも使える no-op logger。
 * ライブラリ関数に Logger を渡したくない consumer 向け。
 */
export const NOOP_LOGGER = {
    info: () => { },
    warn: () => { },
    error: () => { },
    debug: () => { },
};
//# sourceMappingURL=logger.js.map