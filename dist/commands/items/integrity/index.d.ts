/**
 * items integrity - Issue 状態と Project Status の整合性チェック (#1823)
 *
 * Issue 状態と Project Status の不整合を検出・修正する:
 * - OPEN Issue が Done/Released ステータス → close
 * - CLOSED Issue がアクティブステータス → Done に更新
 * - メトリクス: タイムスタンプ欠落・ステイル Issue
 * - Automation 設定確認
 */
import { Logger } from "../../../utils/logger.js";
import { type IssueData } from "../shared/session-utils.js";
import { type Inconsistency, type PrData, type SubIssueSummary } from "./classify.js";
export type { IssueData };
export type { Inconsistency, InconsistencySeverity, PrData, SubIssueSummary } from "./classify.js";
export interface IntegrityOptions {
    owner?: string;
    verbose?: boolean;
    fix?: boolean;
    setup?: boolean;
}
/** 不整合の修正結果 */
export interface FixResult {
    number: number;
    action: string;
    success: boolean;
    error?: string;
}
/** ワークフロー自動化チェック結果 */
export interface AutomationStatus {
    checked: boolean;
    workflows: Array<{
        name: string;
        enabled: boolean;
        recommended: boolean;
    }>;
    missing_recommended: string[];
}
/** integrity チェックの出力構造 */
export interface IntegrityOutput {
    repository: string;
    inconsistencies: Inconsistency[];
    fixes: FixResult[];
    automations?: AutomationStatus;
    summary: {
        total: number;
        warnings: number;
        fixed: number;
        fix_failures: number;
        /** ADR-v3-013 例外ルールで OPEN+Done から除外された子 Issue の数 */
        children_of_open_parents: number;
        /** 親紐付け漏れの計画 Issue の数（info 警告） */
        orphaned_plan_issues: number;
    };
}
/**
 * PR を Project Status 付きで取得する。
 */
export declare function fetchPrsWithProjectStatus(owner: string, repo: string, limit?: number): Promise<PrData[]>;
/**
 * プロジェクト内の全アイテムの Text フィールド値を一括取得する。
 * itemId → { fieldName → textValue } のマップを返す。
 */
export declare function fetchItemTextFieldValues(projectId: string): Promise<Record<string, Record<string, string>>>;
/**
 * GitHub GraphQL `timelineItems` API（`ProjectV2ItemStatusChangedEvent`）から
 * 特定ステータスへの遷移時刻を取得する（Projects V2 対応）。
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param issueNumber - Issue 番号
 * @param targetStatus - 遷移先ステータス名（例: "In Progress", "Review"）
 * @param logger - ロガー
 * @returns ISO 8601 タイムスタンプ文字列、取得失敗時は null
 */
export declare function fetchStatusTransitionTimestamp(owner: string, repo: string, issueNumber: number, targetStatus: string, logger: Logger): Promise<string | null>;
/**
 * OPEN Issue のリストに対して Sub-Issue ステータスを取得し、
 * classifyParentStatusInconsistencies の入力形式に変換する。
 *
 * 効率化:
 * - OPEN Issue のみを対象（CLOSED は不要）
 * - Sub-Issue が存在する Issue のみを summaries に含める
 *
 * 副次出力:
 * - `childrenOfOpenParents`: OPEN 親の全子 Issue 番号のセット（計画子・設計子含む）。
 *   classifyInconsistencies の OPEN+Done 例外ルール (ADR-v3-013) 用。
 */
export declare function fetchParentSubIssueSummaries(openIssues: IssueData[], owner: string, repo: string, logger: Logger): Promise<{
    summaries: SubIssueSummary[];
    childrenOfOpenParents: Set<number>;
}>;
export declare function closeIssueById(issueId: string): Promise<boolean>;
/**
 * Issue 状態と Project Status の整合性をチェックし、オプションで修正する。
 */
export declare function cmdIntegrity(options: IntegrityOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map