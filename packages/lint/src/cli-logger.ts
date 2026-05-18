/**
 * ロガーユーティリティ
 */

import chalk from "chalk";
import type { OptionValueSource } from "commander";

export interface Logger {
  info: (message: string) => void;
  success: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
  step: (step: number, total: number, message: string) => void;
}

/**
 * グローバル色制御を適用する。
 * `--no-color` または `CI` / `NO_COLOR` 環境変数で色を無効化し、
 * 明示的な `--color` で強制有効化する。
 * chalk v5 は `NO_COLOR` を自動検出するが、`CI` と CLI フラグは手動で制御する。
 *
 * @param options - Commander.js の opts()。`--no-color` は `{ color: false }` として表現される
 * @param colorSource - `program.getOptionValueSource('color')` の値。
 *   `'cli'` の場合のみ明示的な `--color` と判断し色を強制有効化する。
 *   デフォルト値（`'default'`）の場合は chalk の自動検出に委ねる。
 */
export function applyColorControl(
  options: { color?: boolean; noColor?: boolean },
  colorSource?: OptionValueSource,
): void {
  // 明示的な --color（colorSource === 'cli'）: 環境変数を上書きして色を強制有効化
  if (options.color && colorSource === "cli") {
    chalk.level = 3;
    return;
  }
  // --no-color（Commander.js: color === false）または後方互換の noColor
  if (options.color === false || options.noColor || process.env.CI || process.env.NO_COLOR !== undefined) {
    chalk.level = 0;
  }
}

/**
 * ロガーを作成
 *
 * @param verbose - デバッグ/ステップログを有効化
 * @param useStderr - true の場合、info/success/warn/debug/step を stderr に出力する。
 *   JSON 出力モード（`-f json`）では stdout を純粋な JSON に保つために true を指定する。
 */
export function createLogger(verbose: boolean = false, useStderr: boolean = false): Logger {
  const log = useStderr ? console.error : console.log;
  return {
    info: (message: string) => {
      log(chalk.blue("info"), message);
    },
    success: (message: string) => {
      log(chalk.green("done"), message);
    },
    warn: (message: string) => {
      log(chalk.yellow("warn"), message);
    },
    error: (message: string) => {
      // error は常に stderr（useStderr 設定に関わらず）
      console.error(chalk.red("error"), message);
    },
    debug: (message: string) => {
      if (verbose) {
        log(chalk.gray("debug"), message);
      }
    },
    step: (step: number, total: number, message: string) => {
      if (verbose) {
        log(
          chalk.cyan(`[${step}/${total}]`),
          message
        );
      }
    },
  };
}
