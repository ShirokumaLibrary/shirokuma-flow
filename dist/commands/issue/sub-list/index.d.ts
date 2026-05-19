/**
 * items sub-list サブコマンド (#1814)
 *
 * issues sub list から移行。親 Issue のサブ Issue を一覧表示する。
 * Sub-Issues API（GraphQL-Features: sub_issues ヘッダー）を使用する。
 */
import { Logger } from "../../../utils/logger.js";
import type { SubListOptions } from "../../items/types.js";
/**
 * items sub-list サブコマンド - 親 Issue のサブ Issue を一覧表示する。
 */
export declare function cmdSubList(parentNumberStr: string, options: SubListOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map