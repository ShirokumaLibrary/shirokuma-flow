/**
 * ロガーユーティリティ
 */
import chalk from "chalk";
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
export function applyColorControl(options, colorSource) {
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
 */
export function createLogger(verbose = false) {
    return {
        info: (message) => {
            console.log(chalk.blue("info"), message);
        },
        success: (message) => {
            console.log(chalk.green("done"), message);
        },
        warn: (message) => {
            console.log(chalk.yellow("warn"), message);
        },
        error: (message) => {
            console.error(chalk.red("error"), message);
        },
        debug: (message) => {
            if (verbose) {
                console.log(chalk.gray("debug"), message);
            }
        },
        step: (step, total, message) => {
            if (verbose) {
                console.log(chalk.cyan(`[${step}/${total}]`), message);
            }
        },
    };
}
//# sourceMappingURL=logger.js.map