/**
 * ドキュメント fetch 系ユーティリティが利用する最小の Logger インターフェース。
 * chalk 等の色制御は consumer 側の logger に委ねることで、本パッケージの依存を
 * 軽量に保つ（shirokuma-flow 側の createLogger は `chalk` を使うが、library 層
 * では node:console 既定実装のみ提供する）。
 */
export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug?: (message: string) => void;
}

/**
 * `console` にそのまま書き出す既定 logger。verbose=true なら debug も出す。
 * 色付けや step 表示が必要な場合は consumer 側が独自の `Logger` を渡す。
 */
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

/**
 * Logger 未指定時にどこでも使える no-op logger。
 * ライブラリ関数に Logger を渡したくない consumer 向け。
 */
export const NOOP_LOGGER: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};
