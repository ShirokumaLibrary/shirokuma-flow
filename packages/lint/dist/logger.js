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
export const NOOP_LOGGER = {
    info: () => { },
    warn: () => { },
    error: () => { },
    debug: () => { },
};
//# sourceMappingURL=logger.js.map