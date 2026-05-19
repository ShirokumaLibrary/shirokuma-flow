/**
 * items reopen - Issue 再オープンロジック (#1810, #2024)
 *
 * issues reopen ロジックを items サブコマンドとして提供する。
 * #2024 Phase 2-A: Cancelled → Backlog の遷移検証を追加。
 */
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../../items/types.js";
/**
 * items reopen - クローズ済み Issue を再オープンする。
 */
export declare function cmdItemReopen(issueNumberStr: string, options: ItemsOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map