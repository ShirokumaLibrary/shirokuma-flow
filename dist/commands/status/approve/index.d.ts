/**
 * status approve サブコマンド
 *
 * Review ステータスの Issue を明示的に承認して Done に遷移する。
 * Status 更新のみで Issue 本体はクローズしない（Done(Open) の中間状態を許容）。
 * CLOSED 化は親 Close 連動もしくは明示的な items close で行う（ADR-v3-013）。
 */
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../../items/types.js";
export type ApproveOptions = ItemsOptions;
export interface ApproveResult {
    number: number;
    from: string | null;
    to: string;
    result: "ok" | "error";
    message?: string;
    /** ステータス更新後に GraphQL で再読み取りして確認した実際のステータス値 */
    current_status_after_update?: string | null;
    next_suggestions: string[];
    parent_status: string | null;
    sibling_statuses: string[];
    has_plan_children: boolean;
    has_pending_subissues: boolean;
    pending_subissues: number[];
}
export declare function cmdItemApprove(numberStr: string, options: ApproveOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map