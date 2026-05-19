/**
 * items shared utilities
 *
 * Types, constants, and helper functions used by items subcommands.
 */
import { Logger } from "../../../utils/logger.js";
import { type ProjectField } from "../../../utils/project-fields.js";
export { DEFAULT_EXCLUDE_STATUSES } from "../../../utils/status-workflow.js";
/** Git repository state (branch + uncommitted changes) */
export interface GitState {
    currentBranch: string | null;
    uncommittedChanges: string[];
    hasUncommittedChanges: boolean;
}
/** Extended git state for preflight checks */
export interface PreflightGitState {
    branch: string | null;
    baseBranch: string | null;
    isFeatureBranch: boolean;
    uncommittedChanges: string[];
    hasUncommittedChanges: boolean;
    unpushedCommits: number | null;
    recentCommits: Array<{
        hash: string;
        message: string;
    }>;
}
/** Flattened issue info for preflight JSON output (snake_case) */
export interface PreflightIssue {
    number: number;
    title: string;
    status: string | null;
    merged_pr: boolean | null;
}
/** Flattened PR info for preflight JSON output (snake_case) */
export interface PreflightPr {
    number: number;
    title: string;
    review_decision: string | null;
}
/** Full preflight JSON output structure (snake_case) */
export interface PreflightOutput {
    repository: string;
    git: {
        branch: string | null;
        base_branch: string | null;
        is_feature_branch: boolean;
        uncommitted_changes: number;
        unpushed_commits: number | null;
        recent_commits: Array<{
            hash: string;
            message: string;
        }>;
    };
    issues: PreflightIssue[];
    pull_requests: PreflightPr[];
    session_backups: number;
    warnings: string[];
}
export interface IssueData {
    number: number;
    title: string;
    url: string;
    state: string;
    closedAt: string | null;
    labels: string[];
    assignees: string[];
    status: string | null;
    priority: string | null;
    size: string | null;
    projectItemId: string | null;
    projectId: string | null;
    /** 親 Issue 番号（サブ Issue の場合のみ）。integrity チェックで使用 */
    parentNumber?: number;
}
/** Session backup metadata returned by getSessionBackups */
export interface SessionBackup {
    filename: string;
    timestamp: string;
    content: string;
}
export interface HandoverData {
    number: number;
    title: string;
    body: string;
    url: string;
    author: string | null;
}
export declare const PROTECTED_BRANCHES: string[];
export declare function getCurrentUsername(): Promise<string | null>;
export declare function getHandoversCategoryId(owner: string, repo: string, categoryName: string): Promise<string | null>;
/**
 * Fetch handovers from the Handovers category, optionally filtered by author.
 *
 * @param authorFilter - Username to filter by, or null for all
 * @returns The most recent matching handover, or null
 */
export declare function fetchLatestHandover(owner: string, repo: string, categoryId: string, authorFilter: string | null): Promise<HandoverData | null>;
/**
 * Fetch all recent handovers and group by author (latest per author).
 */
export declare function fetchTeamHandovers(owner: string, repo: string, categoryId: string): Promise<HandoverData[]>;
export declare function fetchActiveIssues(owner: string, repo: string, limit: number, states?: string[]): Promise<IssueData[]>;
export declare function updateIssueStatus(projectId: string, itemId: string, statusValue: string, projectFields: Record<string, ProjectField>, logger: Logger, previousStatus?: string): Promise<boolean>;
/**
 * Issue に紐づくマージ済み PR を検出する。
 *
 * 検出戦略:
 * 1. ブランチ名検索: 現在のブランチに対応する merged PR を探す
 * 2. Issue リンク逆引き: マージ済み PR の body から "Closes #N" 等を検索
 *
 * @returns マージ済み PR 番号。見つからない場合は null
 */
export declare function findMergedPrForIssue(owner: string, repo: string, issueNumber: number, logger: Logger): Promise<number | null>;
/**
 * Issue が CLOSED かどうかを REST API で確認する。
 * OPEN-only fetch で見つからない Issue 番号の判定に使用。
 * API 失敗時は false を返し、従来の warn 動作にフォールバック（安全側）。
 */
export declare function isIssueClosed(owner: string, repo: string, num: number): Promise<boolean>;
/**
 * Get current git repository state (branch + uncommitted changes).
 * Returns safe defaults if git commands fail.
 *
 * @returns ブランチ名と未コミット変更リスト。git 未使用時はデフォルト値を返す
 */
export declare function getGitState(logger?: Logger): Promise<GitState>;
/**
 * Get extended git state for preflight checks.
 * Includes base branch detection, unpushed commit count, and recent commits.
 *
 * @returns 拡張 git 状態（ベースブランチ、未プッシュコミット数、最近のコミット含む）
 * @see getGitState 基本 git 状態の取得
 */
export declare function getPreflightGitState(logger?: Logger): Promise<PreflightGitState>;
/**
 * Generate warnings from git state.
 * Shared by `git check` and `items preflight`.
 *
 * @param state - Preflight git state
 * @param unpushedSuffix - Context-specific suffix for unpushed warning
 * @returns Warning messages array
 */
export declare function generateGitWarnings(state: PreflightGitState, unpushedSuffix?: string): string[];
/**
 * Check for PreCompact session backups in .claude/sessions/.
 * Returns backups sorted by timestamp (most recent first).
 */
export declare function getSessionBackups(): SessionBackup[];
/**
 * Remove all PreCompact session backups from .claude/sessions/.
 * Called after a successful handover to prevent stale backups.
 *
 * @returns Number of files cleaned up
 */
export declare function cleanupSessionBackups(): number;
//# sourceMappingURL=session-utils.d.ts.map