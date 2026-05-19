/**
 * items list サブコマンド (#1814)
 *
 * issues list から移行。Projects フィールド付きで Issue 一覧を取得する。
 *
 * @related items/pull/index.ts - 個別 Issue 取得
 */
import type { Logger } from "../../../utils/logger.js";
import type { ListOptions } from "../types.js";
/**
 * items list サブコマンド
 */
export declare function cmdList(options: ListOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map