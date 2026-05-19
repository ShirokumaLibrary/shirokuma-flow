/**
 * Status workflow constants and transition validation
 *
 * Provides type-safe Status values and validates transitions
 * against the project-items.md workflow definition.
 */
/**
 * All valid Project Status values (新仕様: 6ステータス).
 * Matches items-transition.md workflow definition.
 *
 * 新仕様ステータス (Cancelled 廃止後):
 * - (Draft): プロジェクト未追加状態（GitHub Projects の状態ではない）
 * - Backlog: 未着手（旧 Pending / Ready を統合 #2202）
 * - In progress: 作業中
 * - Blocked: 中断（旧 On Hold を統合 #2203）。reason 必須。
 * - Review: レビュー待ち
 * - Completed: 作業完了・PR 作成済み
 * - Done: 完了（キャンセルも state_reason: not_planned で Done に統合 #2204）
 *
 * @since #2202 Pending / Ready を廃止し Backlog に統合
 * @since #2203 On Hold を廃止し Blocked に統合
 * @since #2204 Cancelled を廃止し Done + state_reason: not_planned に統一
 */
export declare const STATUS_VALUES: {
    readonly BACKLOG: "Backlog";
    readonly IN_PROGRESS: "In progress";
    readonly BLOCKED: "Blocked";
    readonly REVIEW: "Review";
    /**
     * @deprecated ADR-v3-013 により廃止予定。新規コードでは使用しない。
     * 既存 Issue の脱出パス維持のため定数定義と STATUS_TRANSITIONS entry は残している。
     */
    readonly COMPLETED: "Completed";
    readonly DONE: "Done";
};
export type StatusValue = (typeof STATUS_VALUES)[keyof typeof STATUS_VALUES];
/**
 * 旧ステータス互換定数。
 * Phase 4 での削除前に旧コードが参照できるように維持する。
 *
 * @deprecated 新コードでは STATUS_VALUES の新定数を使用すること
 */
export declare const LEGACY_STATUS_VALUES: {
    readonly ICEBOX: "Backlog";
    readonly PREPARING: "Backlog";
    readonly DESIGNING: "Backlog";
    readonly TESTING: "Review";
    readonly RELEASED: "Done";
    readonly NOT_PLANNED: "Cancelled";
    readonly IN_PROGRESS_LEGACY: "In Progress";
    readonly PENDING_LEGACY: "Pending";
    readonly READY_LEGACY: "Ready";
    readonly ON_HOLD_LEGACY: "On Hold";
    readonly CANCELLED_LEGACY: "Cancelled";
};
/**
 * Terminal statuses — items in these states are typically excluded from active views.
 *
 * @since #2204 Cancelled を廃止。Done のみが終端ステータス（キャンセルは Done + state_reason: not_planned で識別）
 */
export declare const TERMINAL_STATUSES: readonly string[];
/**
 * Status order for phase progression.
 * Used for backward transition detection and timestamp clear logic.
 * Single source of truth — do not duplicate in other modules.
 *
 * @since #2202 Ready を除外（Backlog に統合）
 */
export declare const STATUS_ORDER: readonly string[];
/**
 * Detect backward (regression) transitions based on STATUS_ORDER.
 * Returns false if either status is not in STATUS_ORDER.
 */
export declare function isBackwardTransition(from: string, to: string): boolean;
/** Completed statuses — excluded from active lists by default (Done only, not Cancelled) */
export declare const DEFAULT_EXCLUDE_STATUSES: readonly string[];
/**
 * `Backlog` と等価な status 値判定（Pending / Ready の旧表記を Backlog 扱いにマップする透過レイヤー）。
 * 既存 Issue が GitHub Project の旧 option (`Pending` / `Ready`) を保持している間、コード側で 1 値として扱うために使用する。
 */
export declare function isBacklogEquivalent(status: string | null | undefined): boolean;
/**
 * `Blocked` と等価な status 値判定（On Hold の旧表記を Blocked 扱いにマップする透過レイヤー）。
 * 既存 Issue が GitHub Project の旧 option (`On Hold`) を保持している間、コード側で 1 値として扱うために使用する。
 *
 * @since #2203 On Hold を廃止し Blocked に統合
 */
export declare function isBlockedEquivalent(status: string | null | undefined): boolean;
/**
 * `Done (not_planned)` と等価な status 値判定（Cancelled の旧表記を透過マップする）。
 * 既存 Issue が GitHub Project の旧 option (`Cancelled`) を保持している間、コード側で
 * "キャンセル扱い" として判定するために使用する。
 *
 * @since #2204 Cancelled を廃止し Done + state_reason: not_planned に統一
 */
export declare function isCancelledEquivalent(status: string | null | undefined): boolean;
/**
 * Issue 作成時に許可する初期ステータス（ホワイトリスト）。
 * Backlog のみ許可。
 *
 * @remarks
 * - `Pending` / `Ready` は #2202 により Backlog に統合されたため含めない
 * - 既存の Pending / Ready の Issue は LEGACY_STATUS_VALUES 経由で Backlog 扱い
 *
 * @since #2202 Pending / Ready を廃止し Backlog に統合
 */
export declare const INITIAL_STATUSES: readonly string[];
/**
 * Issue 作成時の初期ステータスを検証する。
 * 許可リスト（`INITIAL_STATUSES`）以外のステータスが指定された場合はエラーメッセージを返す。
 *
 * @param status - 検証対象のステータス文字列
 * @returns 許可されている場合は `null`、許可されていない場合はエラーメッセージ
 * @since #2202 Pending / Ready は許可リストから除外（Backlog に統合）
 */
export declare function validateInitialStatus(status: string): string | null;
/**
 * Valid statuses for PRs — subset of Issue workflow (project-items.md).
 *
 * @since #2204 Cancelled を廃止。PR クローズ時は Done（state_reason: not_planned ベース）
 */
export declare const PR_VALID_STATUSES: readonly string[];
/**
 * Statuses indicating work has started — CLOSED issues with these are inconsistent.
 *
 * @since #2202 Pending を除外（Backlog に統合されたため未着手扱い）
 */
export declare const WORK_STARTED_STATUSES: readonly string[];
/**
 * Valid status transitions (adjacency list).
 * Derived from items-transition.md workflow:
 *
 * Main flow: (Draft) → Backlog → In progress → Review → Done
 * Blocked: bidirectional with In Progress, Review（旧 On Hold を統合 #2203）
 * Review: → Done (approve), → In Progress (reject)
 * Completed: → Done (PR merged)
 * Cancel: items cancel は state_reason: not_planned で close して Done に設定（#2204）
 *
 * Backward transitions are allowed for corrections.
 *
 * @since #2202 Pending / Ready エントリを削除（Backlog に統合）
 * @since #2203 On Hold エントリを Blocked に置換
 * @since #2204 Cancelled エントリを削除（Done + state_reason: not_planned に統合）
 */
export declare const STATUS_TRANSITIONS: Record<string, readonly string[]>;
export interface TransitionResult {
    valid: boolean;
    warning?: string;
}
/**
 * Validate a Status transition.
 * Returns { valid: true } for valid transitions or unknown statuses.
 * Returns { valid: false, warning } for non-standard transitions.
 *
 * Warning mode only — never blocks, just warns.
 *
 * @param from - Current status (null/undefined skips validation)
 * @param to - Target status
 */
export declare function validateStatusTransition(from: string | null | undefined, to: string): TransitionResult;
//# sourceMappingURL=status-workflow.d.ts.map