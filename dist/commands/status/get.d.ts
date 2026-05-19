/**
 * status get サブコマンド
 *
 * 指定した Issue / PR の現在ステータスと遷移可能なステータス一覧を JSON で返す。
 */
import type { Logger } from "../../utils/logger.js";
import type { ItemsOptions } from "../items/types.js";
export interface StatusGetResult {
    number: number;
    status: string | null;
    allowed_transitions: string[];
}
export declare function cmdStatusGet(numberStr: string, options: ItemsOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=get.d.ts.map