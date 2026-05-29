/**
 * Status workflow constants and transition validation
 *
 * Provides type-safe Status values and validates transitions
 * against the project-items.md workflow definition.
 *
 * @since #2439 5 値モデルへ移行（ADR-v3-018）
 *   - STATUS_VALUES を 5 値（ToDo / In progress / Blocked / Review / Done）に圧縮
 *   - LEGACY_STATUS_VALUES に旧 3 値（Backlog / Approved / Completed）を追加
 *   - normalizeLegacyStatus() を追加（旧値 → 新値の透過変換）
 *   - INITIAL_STATUSES を In progress 1 値に統一
 * @since #2531 6 値モデル + 4 系統分離へ移行（ADR-v3-022 第二改訂版）
 *   - STATUS_VALUES に BACKLOG を追加（6 値化）
 *   - 4 テーブル分離 (ISSUE_FORWARD / ISSUE_ROLLBACK / PR_FORWARD / PR_ROLLBACK)
 *   - getAllowedTransitions(itemType, from, opts) / validateTransition(itemType, from, to, opts) 追加
 *   - INITIAL_STATUSES を Backlog に変更
 *   - LEGACY_STATUS_VALUES.BACKLOG_LEGACY 削除
 *   - normalizeLegacyStatus 更新（Approved → Done、Pending → Backlog、Ready → ToDo）
 */

// =============================================================================
// Status Constants (6 値モデル: ADR-v3-022 第二改訂版 #2531)
// =============================================================================

/**
 * All valid Project Status values (6 値モデル: ADR-v3-022 第二改訂版).
 * Matches items-transition.md workflow definition.
 *
 * 6 値モデル (ADR-v3-022 第二改訂版):
 * - Backlog: 未調査・未トリアージ。アサインで「調査担当決定」を表現
 * - ToDo: 着手準備完了（調査済み・計画承認済み）
 * - In progress: 作業中（実装フェーズ）
 * - Blocked: 中断中（reason 必須）
 * - Review: PR レビュー待ち専用（D-1 採用）。計画 Issue 子の場合は計画レビュー待ち
 * - Done: 完了（キャンセルも state_reason: not_planned で Done に統合）
 *
 * @since #2202 Pending / Ready を廃止し Backlog に統合
 * @since #2203 On Hold を廃止し Blocked に統合
 * @since #2204 Cancelled を廃止し Done + state_reason: not_planned に統一
 * @since #2389 Approved を plan/design Issue 承認用に追加（Done(Open) 偽装廃止）
 * @since #2439 Backlog → ToDo に改称、Approved / Completed を廃止（ADR-v3-018）
 * @since #2531 Backlog 復活 → 6 値モデル（ADR-v3-022 第二改訂版）
 */
export const STATUS_VALUES = {
  BACKLOG: "Backlog",
  TODO: "ToDo",
  // GitHub Default Workflow が書く表記（小文字 p）に合わせる
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  REVIEW: "Review",
  DONE: "Done",
} as const;

export type StatusValue = (typeof STATUS_VALUES)[keyof typeof STATUS_VALUES];

// =============================================================================
// 旧ステータス互換定数 (LEGACY)
// =============================================================================

/**
 * 旧ステータス互換定数。
 * 旧値の透過読み取り・変換に使用する。
 *
 * @since #2531 BACKLOG_LEGACY 削除（Backlog は再び現役）
 *
 * @deprecated 新コードでは STATUS_VALUES の新定数を使用すること
 */
export const LEGACY_STATUS_VALUES = {
  // BACKLOG_LEGACY 削除（Backlog は STATUS_VALUES に昇格 #2531）
  APPROVED_LEGACY: "Approved", // Approved → Done（#2531: approve 意味変更により Review→Done）
  COMPLETED_LEGACY: "Completed", // Completed → Done（#2439）
  // 旧 → 新のマッピング（既存互換）
  ICEBOX: "Backlog",        // Icebox → Backlog（削除済みステータス）
  PREPARING: "Backlog",     // Preparing → Backlog（削除済みステータス）
  DESIGNING: "Backlog",     // Designing → Backlog（削除済みステータス）
  TESTING: "Review",        // Testing → Review（削除済みステータス）
  RELEASED: "Done",         // Released → Done（削除済みステータス）
  NOT_PLANNED: "Cancelled", // Not Planned → Cancelled（名称変更）
  // GitHub Project の旧オプション名 "In Progress"（大文字 P）。設定ファイルのマッピングキーや
  // 既存 Project の statusToDateMapping で旧表記が必要な箇所から参照する。
  IN_PROGRESS_LEGACY: "In Progress",
  // Pending は Backlog に変換（#2531: 6 値モデルでは未調査として Backlog 相当）
  PENDING_LEGACY: "Pending",
  // Ready は ToDo に変換（着手準備完了相当）
  READY_LEGACY: "Ready",
  // On Hold は Blocked に統合（#2203）。既存 Issue の Blocked 扱いマップに使用する。
  ON_HOLD_LEGACY: "On Hold",
  // Cancelled は Done + state_reason: not_planned に統合（#2204）。既存 Issue の透過マップに使用する。
  CANCELLED_LEGACY: "Cancelled",
} as const;

// =============================================================================
// LEGACY 透過変換ヘルパー (#2531 6 値モデルに対応)
// =============================================================================

/**
 * 旧ステータス値を新 6 値モデルに透過変換する。
 * 現行 6 値はそのまま返す。未知の値もそのまま返す。
 *
 * 変換マッピング (#2531 6 値モデル):
 * - Pending → Backlog（未調査として Backlog 相当）
 * - Ready → ToDo（着手準備完了相当）
 * - Approved → Done（approve 意味変更により Review → Done。旧 Approved も完了扱い）
 * - Completed → Done
 * - その他 LEGACY 値（On Hold → Blocked 相当、Cancelled → Done 相当）は
 *   isBlockedEquivalent / isCancelledEquivalent 側で処理するためここでは変換しない
 *
 * @param value - ステータス文字列（任意）
 * @returns 正規化されたステータス文字列
 * @since #2439 ADR-v3-018 LEGACY 透過変換
 * @since #2531 6 値モデル対応（Backlog → ToDo 削除、Approved → Done に変更）
 */
export function normalizeLegacyStatus(value: string): string {
  switch (value) {
    // Pending → Backlog（未調査）
    case LEGACY_STATUS_VALUES.PENDING_LEGACY:
      return STATUS_VALUES.BACKLOG;
    // Ready → ToDo（着手準備完了）
    case LEGACY_STATUS_VALUES.READY_LEGACY:
      return STATUS_VALUES.TODO;
    // 旧 Approved → Done（approve 意味変更）
    case LEGACY_STATUS_VALUES.APPROVED_LEGACY:
      return STATUS_VALUES.DONE;
    // 旧 Completed → Done
    case LEGACY_STATUS_VALUES.COMPLETED_LEGACY:
      return STATUS_VALUES.DONE;
    // 現行 6 値またはその他未知の値はそのまま返す
    default:
      return value;
  }
}

/**
 * Terminal statuses — items in these states are typically excluded from active views.
 *
 * @since #2204 Cancelled を廃止。Done のみが終端ステータス（キャンセルは Done + state_reason: not_planned で識別）
 */
export const TERMINAL_STATUSES: readonly string[] = [STATUS_VALUES.DONE];

/**
 * Status order for phase progression.
 * Used for backward transition detection and timestamp clear logic.
 * Single source of truth — do not duplicate in other modules.
 *
 * @since #2202 Ready を除外（Backlog に統合）
 * @since #2439 5 値モデルに更新（Backlog → ToDo、Approved / Completed 削除）
 * @since #2531 6 値モデルに更新（Backlog 復活、ToDo の前に配置）
 */
export const STATUS_ORDER: readonly string[] = [
  STATUS_VALUES.BACKLOG,
  STATUS_VALUES.TODO,
  STATUS_VALUES.IN_PROGRESS,
  STATUS_VALUES.BLOCKED,
  STATUS_VALUES.REVIEW,
  STATUS_VALUES.DONE,
];

/**
 * Detect backward (regression) transitions based on STATUS_ORDER.
 * Returns false if either status is not in STATUS_ORDER.
 */
export function isBackwardTransition(from: string, to: string): boolean {
  const fromIdx = STATUS_ORDER.indexOf(from);
  const toIdx = STATUS_ORDER.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx < fromIdx;
}

/**
 * 前進序列における Status の順位を返す（monotonic forward 比較用）。
 *
 * 序列: `Backlog(0) < ToDo(1) < In progress / Blocked(2) < Review(3) < Done(4)`。
 * In progress と Blocked は同順（どちらも作業中フェーズ）として扱う。
 * `STATUS_ORDER`（後退検出用、In progress=2 / Blocked=3 と別順位）とは異なり、
 * トリアージ後の親 Issue を後退させない判定（`syncParentStatus` 前進のみ化）に使う。
 *
 * LEGACY 値は `normalizeLegacyStatus` で正規化してから順位付けする。
 * 未知の値（マッピング対象外）は `-1` を返す。
 *
 * @param status - ステータス文字列
 * @returns 前進順位（0〜4）。未知の値は -1
 * @since #2683 syncParentStatus 前進のみ化（ADR-v3-022 改訂）
 */
export function statusRank(status: string): number {
  const normalized = normalizeLegacyStatus(status);
  switch (normalized) {
    case STATUS_VALUES.BACKLOG:
      return 0;
    case STATUS_VALUES.TODO:
      return 1;
    case STATUS_VALUES.IN_PROGRESS:
    case STATUS_VALUES.BLOCKED:
      return 2;
    case STATUS_VALUES.REVIEW:
      return 3;
    case STATUS_VALUES.DONE:
      return 4;
    default:
      return -1;
  }
}

/** Completed statuses — excluded from active lists by default (Done only, not Cancelled) */
export const DEFAULT_EXCLUDE_STATUSES: readonly string[] = [STATUS_VALUES.DONE];

/**
 * `Backlog` / `ToDo` 相当の status 値判定（未着手系）。
 * 6 値モデル下では Backlog（未調査）と ToDo（着手準備完了）の両方を含める。
 * 細分化された判定が必要な場合は `isInvestigationPending` (Backlog 専用) /
 * `isReadyForImplementation` (ToDo 専用) を使用する。
 *
 * @since #2439 ToDo を追加（Backlog の後継）
 * @since #2531 6 値モデル対応: Backlog 正規値を追加、BACKLOG_LEGACY 削除
 */
export function isBacklogEquivalent(status: string | null | undefined): boolean {
  return (
    status === STATUS_VALUES.BACKLOG ||
    status === STATUS_VALUES.TODO ||
    status === LEGACY_STATUS_VALUES.PENDING_LEGACY ||
    status === LEGACY_STATUS_VALUES.READY_LEGACY
  );
}

/**
 * 未調査・未トリアージ判定（Backlog 専用）。
 * `isBacklogEquivalent` から分離した、6 値モデル固有の細分化判定 (#2531)。
 *
 * @since #2531
 */
export function isInvestigationPending(status: string | null | undefined): boolean {
  return (
    status === STATUS_VALUES.BACKLOG ||
    status === LEGACY_STATUS_VALUES.PENDING_LEGACY
  );
}

/**
 * 着手準備完了判定（ToDo 専用）。
 * `isBacklogEquivalent` から分離した、6 値モデル固有の細分化判定 (#2531)。
 *
 * @since #2531
 */
export function isReadyForImplementation(status: string | null | undefined): boolean {
  return (
    status === STATUS_VALUES.TODO ||
    status === LEGACY_STATUS_VALUES.READY_LEGACY
  );
}

/**
 * `Blocked` と等価な status 値判定（On Hold の旧表記を Blocked 扱いにマップする透過レイヤー）。
 * 既存 Issue が GitHub Project の旧 option (`On Hold`) を保持している間、コード側で 1 値として扱うために使用する。
 *
 * @since #2203 On Hold を廃止し Blocked に統合
 */
export function isBlockedEquivalent(status: string | null | undefined): boolean {
  return (
    status === STATUS_VALUES.BLOCKED ||
    status === LEGACY_STATUS_VALUES.ON_HOLD_LEGACY
  );
}

/**
 * `Done (not_planned)` と等価な status 値判定（Cancelled の旧表記を透過マップする）。
 * 既存 Issue が GitHub Project の旧 option (`Cancelled`) を保持している間、コード側で
 * "キャンセル扱い" として判定するために使用する。
 *
 * @since #2204 Cancelled を廃止し Done + state_reason: not_planned に統一
 */
export function isCancelledEquivalent(status: string | null | undefined): boolean {
  return status === LEGACY_STATUS_VALUES.CANCELLED_LEGACY;
}

/**
 * Issue 作成時に許可する初期ステータス（ホワイトリスト）。
 * Backlog のみ許可（ADR-v3-022 第二改訂版: 起点を Backlog に変更）。
 *
 * @remarks
 * - issue add で Backlog として作成する。
 * - approve（計画 Issue Done）で親 Issue が Backlog → ToDo に自動同期。
 * - begin コマンドは ToDo → In progress 遷移を担う。
 *
 * @since #2439 Backlog → In progress に変更（ADR-v3-018: 起点統一）
 * @since #2531 In progress → Backlog に再変更（ADR-v3-022 第二改訂版: Backlog 復活）
 */
export const INITIAL_STATUSES: readonly string[] = [
  STATUS_VALUES.BACKLOG,
];

/**
 * Issue 作成時の初期ステータスを検証する。
 * 許可リスト（`INITIAL_STATUSES`）以外のステータスが指定された場合はエラーメッセージを返す。
 *
 * @param status - 検証対象のステータス文字列
 * @returns 許可されている場合は `null`、許可されていない場合はエラーメッセージ
 * @since #2439 許可値を In progress に変更
 * @since #2531 許可値を Backlog に再変更
 */
export function validateInitialStatus(status: string): string | null {
  if (INITIAL_STATUSES.includes(status)) return null;
  return `Issue 作成時の初期ステータス "${status}" は許可されていません。許可値: ${INITIAL_STATUSES.join(", ")}`;
}

/**
 * Valid statuses for PRs — subset of Issue workflow (project-items.md).
 *
 * @since #2204 Cancelled を廃止。PR クローズ時は Done（state_reason: not_planned ベース）
 * @since #2802 Backlog を追加。`pr create` は PR を Backlog で作成し、`review-flow` の
 *   AI レビュー PASS 後に `Backlog → Review` で前進する。OPEN+Backlog は正規の初期状態。
 *   MERGED/CLOSED PR が Backlog のまま残るケースは `classifyPrInconsistencies` のパターン 3
 *   （MERGED/CLOSED 非 Done 検出）で別途 error として検出する。
 */
export const PR_VALID_STATUSES: readonly string[] = [
  STATUS_VALUES.BACKLOG,
  STATUS_VALUES.REVIEW,
  STATUS_VALUES.DONE,
];

/**
 * Statuses indicating work has started — CLOSED issues with these are inconsistent.
 *
 * @since #2439 Completed を削除（5 値モデル移行）
 */
export const WORK_STARTED_STATUSES: readonly string[] = [
  STATUS_VALUES.IN_PROGRESS,
  STATUS_VALUES.REVIEW,
];

// =============================================================================
// Status Transitions: 4 系統分離（Issue/PR × Forward/Rollback）— ADR-v3-022 第二改訂版 #2531
// =============================================================================

/**
 * Issue の正規前進遷移テーブル (#2531, #2683).
 *
 * | From          | To            | コマンド                                          | 用途                                   |
 * |---------------|---------------|--------------------------------------------------|----------------------------------------|
 * | Backlog       | ToDo          | approve（計画 Issue Done 同期）/ 手動              | 計画承認・着手準備完了                  |
 * | Backlog       | Review        | submit（計画 Issue 子）/ 課題 Issue トリアージ提出 | 計画策定完了 / トリアージ承認待ち       |
 * | Backlog       | Done          | cancel                                           | NOT_PLANNED                            |
 * | ToDo          | In progress   | begin / `/implement-flow`                         | 実装着手                                |
 * | ToDo          | Done          | cancel                                           | NOT_PLANNED                            |
 * | In progress   | Blocked       | block                                            | ブロック宣言                            |
 * | In progress   | Done          | close                                            | 直接完了                                |
 * | Blocked       | In progress   | resume                                           | ブロック解除                            |
 * | Review        | ToDo          | approve（課題 Issue トリアージ承認）               | トリアージ承認・着手待ち                |
 * | Review        | Done          | approve（計画 Issue 子）/ pr merge（実装）        | 計画完了 / PR マージ                    |
 *
 * @remarks
 * - `In progress → Review` は ISSUE_FORWARD には含めない（PR 経由のみ。`PR_FORWARD_TRANSITIONS` 参照）
 * - `Review` は「人間レビュー待ち」の総称。Backlog からはトリアージ承認待ち、In progress（PR）からは
 *   PR コードレビュー待ちを表す。
 * - `Review → ToDo` は課題 Issue のトリアージ承認専用（approve の `issue_kind=normal` 分岐）。
 *   計画/設計 Issue 子の approve は引き続き `Review → Done`。
 *
 * @since #2531 ADR-v3-022 第二改訂版
 * @since #2683 トリアージ Status フロー: `Review → ToDo` 追加・`Backlog → Review` を課題 Issue にも許可（ADR-v3-022 改訂）
 */
export const ISSUE_FORWARD_TRANSITIONS: Record<string, readonly string[]> = {
  [STATUS_VALUES.BACKLOG]: [
    STATUS_VALUES.TODO,    // approve（計画 Issue Done 同期 or 手動）
    STATUS_VALUES.REVIEW,  // submit（計画 Issue 子）/ 課題 Issue トリアージ提出 (#2683)
    STATUS_VALUES.DONE,    // cancel
  ],
  [STATUS_VALUES.TODO]: [
    STATUS_VALUES.IN_PROGRESS, // begin
    STATUS_VALUES.DONE,        // cancel
  ],
  [STATUS_VALUES.IN_PROGRESS]: [
    STATUS_VALUES.BLOCKED,     // block
    STATUS_VALUES.DONE,        // close
    // ※ Review への遷移は削除。PR_FORWARD_TRANSITIONS 経由のみ
  ],
  [STATUS_VALUES.BLOCKED]: [
    STATUS_VALUES.IN_PROGRESS, // resume
  ],
  [STATUS_VALUES.REVIEW]: [
    STATUS_VALUES.TODO,        // approve（課題 Issue トリアージ承認、issue_kind=normal）(#2683)
    STATUS_VALUES.DONE,        // approve（計画 Issue 子）/ pr merge（実装 Issue）
  ],
  [STATUS_VALUES.DONE]: [],
};

/**
 * Issue のロールバック遷移テーブル（`--rollback` フラグ必須） (#2531).
 *
 * | From          | To            | 用途                                  |
 * |---------------|---------------|---------------------------------------|
 * | In progress   | Backlog       | 計画やり直し                           |
 * | Blocked       | Backlog       | 放棄して再調査                         |
 * | Review        | Backlog       | 計画 Issue 子のレビュー差し戻し         |
 * | Done          | In progress   | 再オープン（実装継続）                 |
 * | Done          | ToDo          | 再オープン（着手前に戻す）             |
 * | Done          | Backlog       | 再オープン（再調査が必要）             |
 *
 * @since #2531
 */
export const ISSUE_ROLLBACK_TRANSITIONS: Record<string, readonly string[]> = {
  [STATUS_VALUES.IN_PROGRESS]: [STATUS_VALUES.BACKLOG],
  [STATUS_VALUES.BLOCKED]:     [STATUS_VALUES.BACKLOG],
  [STATUS_VALUES.REVIEW]:      [STATUS_VALUES.BACKLOG],
  [STATUS_VALUES.DONE]: [
    STATUS_VALUES.IN_PROGRESS,
    STATUS_VALUES.TODO,
    STATUS_VALUES.BACKLOG,
  ],
};

/**
 * PR の正規前進遷移テーブル (#2531).
 *
 * | From          | To            | コマンド                | 用途                              |
 * |---------------|---------------|-------------------------|-----------------------------------|
 * | Backlog       | Review        | status transition       | AI レビュー PASS 後の前進 (#2802) |
 * | In progress   | Review        | pr create / pr open     | PR 作成・コードレビュー依頼（互換）|
 * | Review        | Done          | pr merge                | PR マージ                         |
 *
 * @remarks #2802: `pr create` は PR を Backlog で作成するため、`review-flow` の
 * AI レビュー PASS 後に `Backlog → Review` で前進できる必要がある。
 * `In progress → Review` は後方互換と手動運用救済のため残す。
 *
 * @since #2531
 */
export const PR_FORWARD_TRANSITIONS: Record<string, readonly string[]> = {
  [STATUS_VALUES.BACKLOG]:     [STATUS_VALUES.REVIEW],
  [STATUS_VALUES.IN_PROGRESS]: [STATUS_VALUES.REVIEW],
  [STATUS_VALUES.REVIEW]:      [STATUS_VALUES.DONE],
};

/**
 * PR のロールバック遷移テーブル（`--rollback` フラグ必須） (#2531).
 *
 * | From          | To            | 用途                              |
 * |---------------|---------------|-----------------------------------|
 * | Review        | In progress   | PR コードレビュー差し戻し（reject） |
 *
 * @remarks Done からの戻しは Status 操作では行わない（revert PR を別作成）
 *
 * @since #2531
 */
export const PR_ROLLBACK_TRANSITIONS: Record<string, readonly string[]> = {
  [STATUS_VALUES.REVIEW]: [STATUS_VALUES.IN_PROGRESS],
};

// =============================================================================
// Transition Validation
// =============================================================================

export interface TransitionResult {
  valid: boolean;
  /** 遷移の種類。`forward` = 正規前進、`rollback` = ロールバック（警告付き） */
  kind?: "forward" | "rollback";
  warning?: string;
  error?: string;
}

/**
 * itemType 別の許可遷移を取得する (#2531).
 * `--rollback` フラグの有無で `forward` / `rollback` テーブルを合成する。
 *
 * @param itemType - "issue" or "pr"
 * @param from - Current status
 * @param options.allowRollback - rollback テーブルを含めるか
 *
 * @since #2531 ADR-v3-022 第二改訂版
 */
export function getAllowedTransitions(
  itemType: "issue" | "pr",
  from: string,
  options: { allowRollback?: boolean } = {},
): { forward: readonly string[]; rollback: readonly string[] } {
  const fwdTable = itemType === "issue" ? ISSUE_FORWARD_TRANSITIONS : PR_FORWARD_TRANSITIONS;
  const rbTable  = itemType === "issue" ? ISSUE_ROLLBACK_TRANSITIONS : PR_ROLLBACK_TRANSITIONS;
  return {
    forward:  fwdTable[from] ?? [],
    rollback: options.allowRollback ? (rbTable[from] ?? []) : [],
  };
}

/**
 * itemType 別の Status 遷移を検証する (#2531).
 *
 * - 正規前進遷移なら `{ valid: true, kind: "forward" }`
 * - ロールバック遷移（`allowRollback: true` 時のみ）なら `{ valid: true, kind: "rollback", warning }`
 * - `--rollback` フラグなしで rollback 先を指定した場合は専用エラー
 * - その他の不正遷移は `{ valid: false, error }`
 *
 * @param itemType - "issue" or "pr"
 * @param from - Current status (null/undefined skips validation, e.g. 新規作成)
 * @param to - Target status
 * @param options.allowRollback - ロールバック遷移を許可するか
 *
 * @since #2531 ADR-v3-022 第二改訂版
 */
export function validateTransition(
  itemType: "issue" | "pr",
  from: string | null | undefined,
  to: string,
  options: { allowRollback?: boolean } = {},
): TransitionResult {
  if (!from) return { valid: true, kind: "forward" }; // 新規作成

  const { forward, rollback } = getAllowedTransitions(itemType, from, options);
  if (forward.includes(to))  return { valid: true, kind: "forward" };
  if (rollback.includes(to)) {
    return {
      valid: true,
      kind: "rollback",
      warning: `[ROLLBACK] ${from} → ${to}`,
    };
  }

  // --rollback なしで rollback 先を指定したケースは専用エラーで誘導
  const rbTable = itemType === "issue" ? ISSUE_ROLLBACK_TRANSITIONS : PR_ROLLBACK_TRANSITIONS;
  if (rbTable[from]?.includes(to)) {
    return {
      valid: false,
      error: `${from} → ${to} は rollback 遷移です。--rollback フラグが必要です`,
    };
  }

  const expectedList = forward.length > 0 ? forward.join(", ") : "(terminal status)";
  return {
    valid: false,
    error: `${from} → ${to} は許可されていない遷移です (${itemType}). 期待: ${expectedList}`,
  };
}
