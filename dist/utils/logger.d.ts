/**
 * ロガーユーティリティ
 */
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
export declare function applyColorControl(options: {
    color?: boolean;
    noColor?: boolean;
}, colorSource?: OptionValueSource): void;
/**
 * ロガーを作成
 */
export declare function createLogger(verbose?: boolean): Logger;
//# sourceMappingURL=logger.d.ts.map