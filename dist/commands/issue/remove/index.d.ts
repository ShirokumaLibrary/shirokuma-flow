/**
 * items remove サブコマンド (#1814)
 *
 * issues remove から移行。プロジェクトから Issue を削除する。
 */
import type { Logger } from "../../../utils/logger.js";
import type { RemoveOptions } from "../../items/types.js";
/**
 * items remove サブコマンド - プロジェクトから Issue を削除する。
 */
export declare function cmdRemove(target: string, options: RemoveOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map