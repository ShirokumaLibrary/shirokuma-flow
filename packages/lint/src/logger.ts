export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug?: (message: string) => void;
}

export function createConsoleLogger(verbose = false): Logger {
  return {
    info: (m) => console.log(`[info] ${m}`),
    warn: (m) => console.log(`[warn] ${m}`),
    error: (m) => console.error(`[error] ${m}`),
    debug: (m) => {
      if (verbose) console.log(`[debug] ${m}`);
    },
  };
}

export const NOOP_LOGGER: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};
