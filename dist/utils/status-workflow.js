/**
 * Status workflow constants and transition validation
 *
 * Provides type-safe Status values and validates transitions
 * against the project-items.md workflow definition.
 */
// =============================================================================
// Status Constants (新仕様: 9 ステータス + Draft)
// =============================================================================
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
export const STATUS_VALUES = {
    BACKLOG: "Backlog",
    // GitHub Default Workflow が書く表記（小文字 p）に合わせる
    IN_PROGRESS: "In progress",
    BLOCKED: "Blocked",
    REVIEW: "Review",
    /**
     * @deprecated ADR-v3-013 により廃止予定。新規コードでは使用しない。
     * 既存 Issue の脱出パス維持のため定数定義と STATUS_TRANSITIONS entry は残している。
     */
    COMPLETED: "Completed",
    DONE: "Done",
};
// =============================================================================
// 旧ステータス互換定数 (Phase 4 削除予定)
// =============================================================================
/**
 * 旧ステータス互換定数。
 * Phase 4 での削除前に旧コードが参照できるように維持する。
 *
 * @deprecated 新コードでは STATUS_VALUES の新定数を使用すること
 */
export const LEGACY_STATUS_VALUES = {
    // 旧 → 新のマッピング
    ICEBOX: "Backlog", // Icebox → Backlog（削除済みステータス）
    PREPARING: "Backlog", // Preparing → Backlog（削除済みステータス）
    DESIGNING: "Backlog", // Designing → Backlog（削除済みステータス）
    TESTING: "Review", // Testing → Review（削除済みステータス）
    RELEASED: "Done", // Released → Done（削除済みステータス）
    NOT_PLANNED: "Cancelled", // Not Planned → Cancelled（名称変更）
    // GitHub Project の旧オプション名 "In Progress"（大文字 P）。設定ファイルのマッピングキーや
    // 既存 Project の statusToDateMapping で旧表記が必要な箇所から参照する。
    IN_PROGRESS_LEGACY: "In Progress",
    // Pending / Ready は Backlog に統合（#2202）。既存 Issue の Backlog 扱いマップに使用する。
    PENDING_LEGACY: "Pending",
    READY_LEGACY: "Ready",
    // On Hold は Blocked に統合（#2203）。既存 Issue の Blocked 扱いマップに使用する。
    ON_HOLD_LEGACY: "On Hold",
    // Cancelled は Done + state_reason: not_planned に統合（#2204）。既存 Issue の透過マップに使用する。
    CANCELLED_LEGACY: "Cancelled",
};
/**
 * Terminal statuses — items in these states are typically excluded from active views.
 *
 * @since #2204 Cancelled を廃止。Done のみが終端ステータス（キャンセルは Done + state_reason: not_planned で識別）
 */
export const TERMINAL_STATUSES = [STATUS_VALUES.DONE];
/**
 * Status order for phase progression.
 * Used for backward transition detection and timestamp clear logic.
 * Single source of truth — do not duplicate in other modules.
 *
 * @since #2202 Ready を除外（Backlog に統合）
 */
export const STATUS_ORDER = [
    STATUS_VALUES.BACKLOG,
    STATUS_VALUES.IN_PROGRESS,
    STATUS_VALUES.COMPLETED,
    STATUS_VALUES.REVIEW,
    STATUS_VALUES.DONE,
];
/**
 * Detect backward (regression) transitions based on STATUS_ORDER.
 * Returns false if either status is not in STATUS_ORDER.
 */
export function isBackwardTransition(from, to) {
    const fromIdx = STATUS_ORDER.indexOf(from);
    const toIdx = STATUS_ORDER.indexOf(to);
    if (fromIdx === -1 || toIdx === -1)
        return false;
    return toIdx < fromIdx;
}
/** Completed statuses — excluded from active lists by default (Done only, not Cancelled) */
export const DEFAULT_EXCLUDE_STATUSES = [STATUS_VALUES.DONE];
/**
 * `Backlog` と等価な status 値判定（Pending / Ready の旧表記を Backlog 扱いにマップする透過レイヤー）。
 * 既存 Issue が GitHub Project の旧 option (`Pending` / `Ready`) を保持している間、コード側で 1 値として扱うために使用する。
 */
export function isBacklogEquivalent(status) {
    return (status === STATUS_VALUES.BACKLOG ||
        status === LEGACY_STATUS_VALUES.PENDING_LEGACY ||
        status === LEGACY_STATUS_VALUES.READY_LEGACY);
}
/**
 * `Blocked` と等価な status 値判定（On Hold の旧表記を Blocked 扱いにマップする透過レイヤー）。
 * 既存 Issue が GitHub Project の旧 option (`On Hold`) を保持している間、コード側で 1 値として扱うために使用する。
 *
 * @since #2203 On Hold を廃止し Blocked に統合
 */
export function isBlockedEquivalent(status) {
    return (status === STATUS_VALUES.BLOCKED ||
        status === LEGACY_STATUS_VALUES.ON_HOLD_LEGACY);
}
/**
 * `Done (not_planned)` と等価な status 値判定（Cancelled の旧表記を透過マップする）。
 * 既存 Issue が GitHub Project の旧 option (`Cancelled`) を保持している間、コード側で
 * "キャンセル扱い" として判定するために使用する。
 *
 * @since #2204 Cancelled を廃止し Done + state_reason: not_planned に統一
 */
export function isCancelledEquivalent(status) {
    return status === LEGACY_STATUS_VALUES.CANCELLED_LEGACY;
}
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
export const INITIAL_STATUSES = [
    STATUS_VALUES.BACKLOG,
];
/**
 * Issue 作成時の初期ステータスを検証する。
 * 許可リスト（`INITIAL_STATUSES`）以外のステータスが指定された場合はエラーメッセージを返す。
 *
 * @param status - 検証対象のステータス文字列
 * @returns 許可されている場合は `null`、許可されていない場合はエラーメッセージ
 * @since #2202 Pending / Ready は許可リストから除外（Backlog に統合）
 */
export function validateInitialStatus(status) {
    if (INITIAL_STATUSES.includes(status))
        return null;
    return `Issue 作成時の初期ステータス "${status}" は許可されていません。許可値: ${INITIAL_STATUSES.join(", ")}`;
}
/**
 * Valid statuses for PRs — subset of Issue workflow (project-items.md).
 *
 * @since #2204 Cancelled を廃止。PR クローズ時は Done（state_reason: not_planned ベース）
 */
export const PR_VALID_STATUSES = [
    STATUS_VALUES.REVIEW,
    STATUS_VALUES.DONE,
];
/**
 * Statuses indicating work has started — CLOSED issues with these are inconsistent.
 *
 * @since #2202 Pending を除外（Backlog に統合されたため未着手扱い）
 */
export const WORK_STARTED_STATUSES = [
    STATUS_VALUES.IN_PROGRESS,
    STATUS_VALUES.REVIEW,
    STATUS_VALUES.COMPLETED,
];
// =============================================================================
// Status Transitions (新仕様)
// =============================================================================
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
export const STATUS_TRANSITIONS = {
    [STATUS_VALUES.BACKLOG]: [
        STATUS_VALUES.IN_PROGRESS,
    ],
    [STATUS_VALUES.IN_PROGRESS]: [
        // ADR-v3-013: COMPLETED は新規遷移先から除外（脱出パスは COMPLETED → DONE のみ残す）
        STATUS_VALUES.REVIEW,
        STATUS_VALUES.BLOCKED,
    ],
    [STATUS_VALUES.BLOCKED]: [
        STATUS_VALUES.IN_PROGRESS,
    ],
    [STATUS_VALUES.REVIEW]: [
        STATUS_VALUES.DONE,
        STATUS_VALUES.IN_PROGRESS,
        STATUS_VALUES.BLOCKED,
    ],
    [STATUS_VALUES.COMPLETED]: [
        STATUS_VALUES.DONE,
    ],
    [STATUS_VALUES.DONE]: [],
};
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
export function validateStatusTransition(from, to) {
    // Skip validation if current status is unknown
    if (!from)
        return { valid: true };
    const allowed = STATUS_TRANSITIONS[from];
    // Unknown current status — skip validation
    if (!allowed)
        return { valid: true };
    if (allowed.includes(to))
        return { valid: true };
    const expectedList = allowed.length > 0 ? allowed.join(", ") : "(terminal status)";
    return {
        valid: false,
        warning: `Status transition "${from}" → "${to}" is not standard. Expected: ${expectedList}`,
    };
}
//# sourceMappingURL=status-workflow.js.map