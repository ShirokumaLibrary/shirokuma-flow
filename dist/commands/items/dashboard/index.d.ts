/**
 * items dashboard - アクティブ Issue/PR + git 状態の一括取得 (#1823)
 *
 * アクティブ Issue/PR + git 状態に特化したダッシュボードを提供する。
 */
import { Logger } from "../../../utils/logger.js";
import type { OutputFormat } from "../../../utils/formatters.js";
import { type IssueData } from "../shared/session-utils.js";
export interface DashboardOptions {
    owner?: string;
    verbose?: boolean;
    format?: OutputFormat;
    team?: boolean;
}
/** Issue リストを担当者別にグループ化する */
export declare function groupIssuesByAssignee(issues: IssueData[]): Record<string, IssueData[]>;
/**
 * アクティブ Issue/PR + git 状態を一括取得して出力する。
 */
export declare function cmdDashboard(options: DashboardOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map