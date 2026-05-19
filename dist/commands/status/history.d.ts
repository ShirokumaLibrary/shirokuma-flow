/**
 * status history サブコマンド (#2224 Phase 5-8)
 *
 * Issue の Status 変更履歴を GitHub GraphQL API（`ProjectV2ItemStatusChangedEvent`）から取得して
 * タイムスタンプ付きで表示する。Projects V2 のみ対応（classic Projects は対象外）。
 */
import type { Logger } from "../../utils/logger.js";
import type { ItemsOptions } from "../items/types.js";
export interface StatusHistoryEntry {
    timestamp: string;
    from: string | null;
    to: string;
    actor: string | null;
    was_automated: boolean;
    project_number: number | null;
    project_title: string | null;
}
export interface StatusHistoryResult {
    number: number;
    title: string;
    total: number;
    history: StatusHistoryEntry[];
}
interface HistoryOptions extends ItemsOptions {
    limit?: number;
    format?: string;
    project?: number;
}
export declare function cmdStatusHistory(numberStr: string, options: HistoryOptions, logger: Logger): Promise<number>;
export {};
//# sourceMappingURL=history.d.ts.map