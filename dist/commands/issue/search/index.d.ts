/**
 * items search サブコマンド (#1814, #1818)
 *
 * issues search から移行。Issue と PR をキーワード検索する。
 * --type オプションで issues / discussions / both を切り替え可能 (#1818)。
 */
import type { Logger } from "../../../utils/logger.js";
import type { SearchOptions } from "../../items/types.js";
/**
 * items search サブコマンド
 */
export declare function cmdSearch(options: SearchOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map