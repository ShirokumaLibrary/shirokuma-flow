/**
 * status allowed サブコマンド
 *
 * 指定したステータスから遷移可能なステータス一覧を返す。
 *
 * 使い方:
 *   status allowed 123                      # Issue #123 の現在ステータスから照会
 *   status allowed --status "In progress"   # ステータス名で静的照会
 */
import type { Logger } from "../../utils/logger.js";
import type { ItemsOptions } from "../items/types.js";
export interface StatusAllowedOptions extends ItemsOptions {
    /** 現在のステータスを直接指定（静的照会）。指定時は Issue 番号照会をスキップ */
    status?: string;
}
export interface StatusAllowedResult {
    current_status: string | null;
    allowed_transitions: string[];
    /** 照会が静的（--status フラグ経由）かどうか */
    static?: boolean;
}
export declare function cmdStatusAllowed(numberStr: string | undefined, options: StatusAllowedOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=allowed.d.ts.map