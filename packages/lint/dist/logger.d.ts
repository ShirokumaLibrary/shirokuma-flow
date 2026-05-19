export interface Logger {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    debug?: (message: string) => void;
}
export declare function createConsoleLogger(verbose?: boolean): Logger;
export declare const NOOP_LOGGER: Logger;
//# sourceMappingURL=logger.d.ts.map