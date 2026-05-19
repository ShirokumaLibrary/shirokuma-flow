/**
 * integrity classify - Pure function 群 (#1839)
 *
 * Issue/PR/メトリクス/親ステータスの不整合を分類する Pure function を集約。
 * API 呼び出しなし、完全にテスト可能。
 */

import type { IssueData } from "../shared/session-utils.js";
import { DEFAULT_EXCLUDE_STATUSES } from "../shared/session-utils.js";
import { WORK_STARTED_STATUSES, PR_VALID_STATUSES, STATUS_VALUES, LEGACY_STATUS_VALUES, isCancelledEquivalent, normalizeLegacyStatus } from "../../../utils/status-workflow.js";
import { deriveExpectedParentStatus, isPlanIssueFromLabels, isPlanOrDesignIssue } from "../../../utils/parent-status.js";
import type { MetricsConfig } from "../../../utils/gh-config.js";

// =============================================================================
// classifyOrphanedPlanIssues
// =============================================================================

/**
 * OPEN の計画 Issue のうち、親 Issue に紐付けられていないものを検出する。
 * Pure function - API 呼び出しなし、完全にテスト可能。
 *
 * 計画 Issue の判定は isPlanIssueFromLabels() に集約。
 * `area:plan` ラベルを正、タイトルプレフィックス「計画:」/「Plan:」をフォールバックとする。
 *
 * @param openIssues - OPEN 状態の全 Issue
 * @param childrenOfOpenParents - OPEN 親の全子 Issue 番号セット（fetchParentSubIssueSummaries の副次出力）
 * @returns Inconsistency[]（severity: "info"）
 */
export function classifyOrphanedPlanIssues(
  openIssues: IssueData[],
  childrenOfOpenParents: Set<number>
): Inconsistency[] {
  const inconsistencies: Inconsistency[] = [];

  for (const issue of openIssues) {
    if (!isPlanIssueFromLabels(issue.labels, issue.title)) continue;
    if (childrenOfOpenParents.has(issue.number)) continue;

    // #2410: 孤立した計画 Issue は修正すべき状態のため info → warning に昇格する。
    inconsistencies.push({
      number: issue.number,
      title: issue.title,
      url: issue.url,
      issueState: issue.state,
      projectStatus: issue.status,
      severity: "warning",
      description: `Plan Issue #${issue.number} has no OPEN epic parent (title: "${issue.title}")`,
    });
  }

  return inconsistencies;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * statusToDateMapping の値を配列に正規化する。
 * 文字列の場合は単一要素の配列に、配列の場合はそのまま返す。
 * 整合性チェックは全要素を対象にする。
 */
export function getAllMappingValues(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// =============================================================================
// Types
// =============================================================================

export type InconsistencySeverity = "error" | "warning" | "info";

/** Issue 状態と Project Status の不整合 */
export interface Inconsistency {
  number: number;
  title: string;
  url: string;
  issueState: string;
  projectStatus: string | null;
  severity: InconsistencySeverity;
  description: string;
  /** 構造化メタデータ（--fix で description をパースせずに情報を取得するため） */
  metadata?: Record<string, string>;
}

/** PR data with project status for integrity checks */
export interface PrData {
  number: number;
  title: string;
  url: string;
  /** OPEN | MERGED | CLOSED */
  state: string;
  status: string | null;
  projectItemId: string | null;
  projectId: string | null;
  /** PR のベースブランチ名（baseRefName）。integrity ベースブランチチェックで使用 */
  baseBranch?: string | null;
  /** PR がクローズする Issue 番号リスト（closingIssuesReferences）。integrity チェックで使用 */
  closingIssueNumbers?: number[];
}

/**
 * 親 Issue の Sub-Issue ステータスサマリー
 * classifyParentStatusInconsistencies の入力型
 */
export interface SubIssueSummary {
  /** 親 Issue 番号 */
  number: number;
  title: string;
  url: string;
  /** 親 Issue の現在のステータス */
  currentStatus: string | null;
  projectItemId: string | null;
  projectId: string | null;
  /** Sub-Issue のステータスリスト（null は除外済み） */
  subIssueStatuses: string[];
}

// =============================================================================
// classifyInconsistencies
// =============================================================================

/**
 * Issue リストから不整合を分類する。
 * Pure function - API 呼び出しなし、完全にテスト可能。
 *
 * 検出パターン:
 * 1. OPEN Issue が Done/Released ステータス → error
 * 2. CLOSED Issue がアクティブステータス → error (work-started) / info (pre-work)
 *
 * ADR-v3-013: 親 Issue が Open の子 Issue の Done(Open) は中間状態として許容する。
 * `childrenOfOpenParents` に含まれる番号は OPEN+Done でも error 報告しない。
 */
export function classifyInconsistencies(
  issues: IssueData[],
  doneStatuses: readonly string[] = DEFAULT_EXCLUDE_STATUSES,
  childrenOfOpenParents?: Set<number>
): Inconsistency[] {
  const inconsistencies: Inconsistency[] = [];

  for (const issue of issues) {
    const status = issue.status ?? "";
    const isDoneStatus = doneStatuses.includes(status);

    // OPEN Issue が Done/Released ステータス
    if (issue.state === "OPEN" && isDoneStatus) {
      // ADR-v3-013: 親が Open の子 Issue の Done(Open) は連動 Close 待ちの中間状態
      if (childrenOfOpenParents?.has(issue.number)) continue;
      inconsistencies.push({
        number: issue.number,
        title: issue.title,
        url: issue.url,
        issueState: issue.state,
        projectStatus: issue.status,
        severity: "error",
        description: `Issue is OPEN but Project Status is "${issue.status}"`,
      });
    }

    // CLOSED Issue が非終端ステータス
    if (issue.state === "CLOSED" && status !== "" && !isDoneStatus) {
      const isWorkStarted = WORK_STARTED_STATUSES.includes(status);
      // #2410: CLOSED + Approved は「Close 後に Status が Done に更新されていない」状態（warning）。
      // work-started（error）より軽微だが info より深刻なため warning に昇格する。
      // #2439: Approved は LEGACY 値（5 値モデル移行後は発生しないが既存 Issue のために維持）
      const isApproved = status === "Approved"; // LEGACY_STATUS_VALUES.APPROVED_LEGACY
      const severity: InconsistencySeverity = isWorkStarted ? "error" : isApproved ? "warning" : "info";
      inconsistencies.push({
        number: issue.number,
        title: issue.title,
        url: issue.url,
        issueState: issue.state,
        projectStatus: issue.status,
        severity,
        description: `Issue is CLOSED but Project Status is "${issue.status}" (expected Done/Released)`,
      });
    }
  }

  return inconsistencies;
}

// =============================================================================
// classifyPrInconsistencies
// =============================================================================

/**
 * PR のステータス不整合を分類する。
 * Pure function - API 呼び出しなし、完全にテスト可能。
 *
 * 検出パターン:
 * 1. OPEN PR が Done ステータス → error
 * 2. MERGED/CLOSED PR がアクティブステータス (In Progress/Review) → error
 * 3. PR に Issue 専用ステータスが設定されている → error
 */
export function classifyPrInconsistencies(prs: PrData[]): Inconsistency[] {
  const inconsistencies: Inconsistency[] = [];

  for (const pr of prs) {
    const status = pr.status ?? "";
    if (!status) continue;

    // PR に Issue 専用ステータスが設定されている
    // #2204: LEGACY Cancelled は valid として扱う（既存 PR の透過マップ）
    if (!PR_VALID_STATUSES.includes(status) && !isCancelledEquivalent(status)) {
      inconsistencies.push({
        number: pr.number,
        title: pr.title,
        url: pr.url,
        issueState: pr.state,
        projectStatus: pr.status,
        severity: "error",
        description: `PR has issue-only status "${status}" (valid PR statuses: ${PR_VALID_STATUSES.join(", ")})`,
      });
      continue;
    }

    // OPEN PR が Done ステータス
    if (pr.state === "OPEN" && status === STATUS_VALUES.DONE) {
      inconsistencies.push({
        number: pr.number,
        title: pr.title,
        url: pr.url,
        issueState: pr.state,
        projectStatus: pr.status,
        severity: "error",
        description: `PR is OPEN but Project Status is "${STATUS_VALUES.DONE}"`,
      });
    }

    // MERGED/CLOSED PR がアクティブステータス
    if ((pr.state === "MERGED" || pr.state === "CLOSED") && (status === STATUS_VALUES.IN_PROGRESS || status === STATUS_VALUES.REVIEW)) {
      inconsistencies.push({
        number: pr.number,
        title: pr.title,
        url: pr.url,
        issueState: pr.state,
        projectStatus: pr.status,
        severity: "error",
        description: `PR is ${pr.state} but Project Status is "${status}" (expected ${STATUS_VALUES.DONE})`,
      });
    }
  }

  return inconsistencies;
}

// =============================================================================
// classifyMetricsInconsistencies
// =============================================================================

/**
 * メトリクス関連の不整合を分類する。
 * Pure function - API 呼び出しなし。
 *
 * #2617 で `autoSetTimestamps` が廃止されたため、タイムスタンプ欠落の warning は出さない。
 * カスタム `statusToDateMapping` を設定したユーザーは `items integrity --fix` で backfill 可能だが、
 * 自動検出は In Progress ステイルチェック（info）のみに限定する。
 */
export function classifyMetricsInconsistencies(
  issues: IssueData[],
  textFieldValues: Record<string, Record<string, string>>,
  metricsConfig: MetricsConfig,
  now?: Date
): Inconsistency[] {
  const inconsistencies: Inconsistency[] = [];
  const currentTime = now ?? new Date();

  const mapping = metricsConfig.statusToDateMapping ?? {};
  const staleThreshold = metricsConfig.staleThresholdDays ?? 14;

  for (const issue of issues) {
    const status = issue.status ?? "";
    const itemId = issue.projectItemId;
    if (!itemId) continue;

    const textValues = textFieldValues[itemId] ?? {};

    // In Progress がステイル（配列内の最初に見つかったタイムスタンプで判定）
    if (status === STATUS_VALUES.IN_PROGRESS) {
      const inProgressAtFields = getAllMappingValues(mapping[LEGACY_STATUS_VALUES.IN_PROGRESS_LEGACY]);
      const firstTimestamp = inProgressAtFields
        .map((f) => textValues[f])
        .find((v) => v !== undefined);
      if (firstTimestamp) {
        const inProgressAt = new Date(firstTimestamp);
        if (!isNaN(inProgressAt.getTime())) {
          const daysSinceStart = Math.floor(
            (currentTime.getTime() - inProgressAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceStart > staleThreshold) {
            inconsistencies.push({
              number: issue.number,
              title: issue.title,
              url: issue.url,
              issueState: issue.state,
              projectStatus: issue.status,
              severity: "info",
              description: `Metrics: In Progress for ${daysSinceStart} days (stale threshold: ${staleThreshold} days)`,
            });
          }
        }
      }
    }
  }

  return inconsistencies;
}

// =============================================================================
// classifyPrBaseBranchInconsistencies
// =============================================================================

/**
 * PR のベースブランチ不整合を分類する。
 * Pure function - API 呼び出しなし、完全にテスト可能。
 *
 * 検知ロジック:
 * 1. OPEN PR のベースブランチが "develop" である
 * 2. PR に closingIssuesReferences でリンクされた Issue が存在する
 * 3. リンク先 Issue に親 Issue が存在する（= サブ Issue）
 *
 * このパターンに合致する PR を severity: "warning" で報告する。
 *
 * 注意: `issues` は fetchActiveIssues の limit に依存するため、limit 外の古いサブ Issue に
 * 紐づく PR は検知できない（親 Issue の parentNumber 情報が取得できないため）。
 *
 * @param prs - PR データリスト（baseBranch / closingIssueNumbers を含む）
 * @param issues - Issue データリスト（parentNumber を含む）
 * @returns Inconsistency[]（severity: "warning"）
 */
export function classifyPrBaseBranchInconsistencies(
  prs: PrData[],
  issues: IssueData[]
): Inconsistency[] {
  const inconsistencies: Inconsistency[] = [];

  const subIssueNumberSet = new Set<number>();
  for (const issue of issues) {
    if (issue.parentNumber !== undefined) subIssueNumberSet.add(issue.number);
  }

  for (const pr of prs) {
    if (pr.state !== "OPEN") continue;
    if (pr.baseBranch !== "develop") continue;

    const closingNumbers = pr.closingIssueNumbers ?? [];
    const subIssueNumbers = closingNumbers.filter((num) => subIssueNumberSet.has(num));
    if (subIssueNumbers.length === 0) continue;

    inconsistencies.push({
      number: pr.number,
      title: pr.title,
      url: pr.url,
      issueState: pr.state,
      projectStatus: pr.status,
      severity: "warning",
      description: `PR #${pr.number} targets "develop" but linked issue(s) ${subIssueNumbers.map((n) => `#${n}`).join(", ")} are sub-issues (expected integration branch, not develop)`,
    });
  }

  return inconsistencies;
}

// =============================================================================
// classifyParentStatusInconsistencies
// =============================================================================

/**
 * Sub-Issue の状態サマリーから親 Issue の期待ステータスを導出し、
 * 実際のステータスと比較して不整合を返す。
 * Pure function - API 呼び出しなし、完全にテスト可能。
 *
 * 導出ルール:
 * 1. subIssueStatuses が空 → スキップ
 * 2. projectItemId が null → スキップ（プロジェクト未参加）
 * 3. 全て "Cancelled" or "Backlog" → 期待: "Backlog"
 * 4. 全て "Done" → 期待: "Done"
 * 5. いずれかがアクティブ → 期待: "In Progress"
 * 6. 親の currentStatus が期待値と異なる → Inconsistency として報告（severity: info）
 */
export function classifyParentStatusInconsistencies(
  parents: SubIssueSummary[]
): Inconsistency[] {
  const inconsistencies: Inconsistency[] = [];

  for (const parent of parents) {
    if (parent.subIssueStatuses.length === 0) continue;
    if (!parent.projectItemId) continue;

    const expectedStatus = deriveExpectedParentStatus(parent.subIssueStatuses);
    if (!expectedStatus) continue;

    if (parent.currentStatus !== expectedStatus) {
      // 親が Done で子に Open がある場合は重大な不整合として error に昇格
      const severity: InconsistencySeverity =
        parent.currentStatus === STATUS_VALUES.DONE ? "error" : "info";
      inconsistencies.push({
        number: parent.number,
        title: parent.title,
        url: parent.url,
        issueState: "OPEN",
        projectStatus: parent.currentStatus,
        severity,
        description: `Parent status should be "${expectedStatus}" based on sub-issue statuses (current: "${parent.currentStatus ?? "null"}")`,
      });
    }
  }

  return inconsistencies;
}

// =============================================================================
// classifyBlockedWithOpenPrInconsistencies
// =============================================================================

/**
 * Blocked Issue に OPEN PR がリンクされているケースを検出する。
 * Pure function - API 呼び出しなし、完全にテスト可能。
 *
 * 検知ロジック:
 * - OPEN Issue の Status が "Blocked"
 * - かつ OPEN PR が `closingIssuesReferences` でその Issue をリンクしている
 *
 * このパターンは GitHub Project Workflow #6（"PR linked to issue"）が発火し、
 * `Blocked → In progress` に自動上書きされる可能性を示す。
 * 開発者が意図せずブロッキング条件未解除のまま進行扱いになることを防ぐための事前警告。
 *
 * @param issues - Issue データリスト（OPEN/CLOSED 含む）
 * @param prs - PR データリスト（state / closingIssueNumbers を含む）
 * @returns Inconsistency[]（severity: "warning"）
 */
export function classifyBlockedWithOpenPrInconsistencies(
  issues: IssueData[],
  prs: PrData[]
): Inconsistency[] {
  const inconsistencies: Inconsistency[] = [];

  // OPEN かつ Blocked の Issue セットを構築
  const blockedIssueMap = new Map<number, IssueData>();
  for (const issue of issues) {
    if (issue.state === "OPEN" && issue.status === STATUS_VALUES.BLOCKED) {
      blockedIssueMap.set(issue.number, issue);
    }
  }

  if (blockedIssueMap.size === 0) return inconsistencies;

  // OPEN PR からリンク先 Issue に Blocked のものがあれば警告
  for (const pr of prs) {
    if (pr.state !== "OPEN") continue;

    const closingNumbers = pr.closingIssueNumbers ?? [];
    for (const issueNum of closingNumbers) {
      const issue = blockedIssueMap.get(issueNum);
      if (!issue) continue;

      inconsistencies.push({
        number: issue.number,
        title: issue.title,
        url: issue.url,
        issueState: issue.state,
        projectStatus: issue.status,
        severity: "warning",
        description: `Issue #${issue.number} is Blocked but OPEN PR #${pr.number} is linked (GitHub Workflow may overwrite Blocked → In progress). Resolve the blocking condition before linking a PR.`,
        metadata: { relatedPrNumber: String(pr.number) },
      });
    }
  }

  return inconsistencies;
}

// =============================================================================
// classifyApprovedInconsistencies - LEGACY 値移行候補の検出 (#2389, #2440)
// =============================================================================

/**
 * LEGACY ステータス値（Approved / Completed）を持つ Issue を検出する。
 *
 * #2440 B案: 移行検出関数として改修。
 * 旧 `Approved` 誤設定チェックから拡張し、ADR-v3-022 第二改訂版への移行候補を検出する。
 *
 * 検出ロジック:
 * 1. Approved (LEGACY): OPEN な通常 Issue が Approved → 誤設定警告 + migrationTarget: "Done"
 *    ただし plan/design Issue の Approved は正常のため除外
 * 2. Completed (LEGACY): OPEN な Issue が Completed → 移行候補 + migrationTarget: "Done"
 *
 * metadata.migrationTarget: sub4 (#2442) が参照して移行先ステータスを決定する
 *
 * @since #2389 Approved 誤設定チェック
 * @since #2440 B案: LEGACY 値全般の移行候補検出に拡張
 */
export function classifyApprovedInconsistencies(
  issues: IssueData[],
): Inconsistency[] {
  const inconsistencies: Inconsistency[] = [];

  // #2440 B案: LEGACY 値セット。5 値モデル移行後に残存するステータスを列挙
  // #2531: BACKLOG_LEGACY 削除（Backlog は 6 値モデルで正規値に復活）
  const legacyStatusSet = new Set<string>([
    LEGACY_STATUS_VALUES.APPROVED_LEGACY, // "Approved" → Done (#2531)
    LEGACY_STATUS_VALUES.COMPLETED_LEGACY, // "Completed" → Done
  ]);

  for (const issue of issues) {
    const status = issue.status ?? "";
    if (!legacyStatusSet.has(status)) continue;
    if (issue.state !== "OPEN") continue;

    const node = {
      title: issue.title,
      labels: { nodes: issue.labels.map((name) => ({ name })) },
    };

    // Approved は plan/design Issue 専用のため、通常 Issue のみを警告対象とする
    if (status === LEGACY_STATUS_VALUES.APPROVED_LEGACY && isPlanOrDesignIssue(node)) continue;

    // migrationTarget: normalizeLegacyStatus() で新値を導出
    const migrationTarget = normalizeLegacyStatus(status);

    let description: string;
    if (status === LEGACY_STATUS_VALUES.APPROVED_LEGACY) {
      description = `Issue #${issue.number} は通常 Issue ですが Approved ステータスです。Approved は plan/design Issue 専用です（--fix で Done に統合します、ADR-v3-022 第二改訂版）`;
    } else {
      // Backlog / Completed: LEGACY 値 → 移行候補
      description = `Issue #${issue.number} は LEGACY ステータス "${status}" です。6 値モデル (ADR-v3-022 第二改訂版) へ移行してください（migrationTarget: "${migrationTarget}"、--fix の実遷移先は sub3 で再整合される予定）`;
    }

    inconsistencies.push({
      number: issue.number,
      title: issue.title,
      url: issue.url,
      issueState: issue.state,
      projectStatus: issue.status,
      severity: "warning",
      description,
      metadata: {
        migrationTarget,
        legacyStatus: status,
      },
    });
  }

  return inconsistencies;
}

// =============================================================================
// PlanParentPair 型 + classifyPlanParentInconsistencies
// =============================================================================

/**
 * 計画 Issue とその親 Issue のペア。
 */
export interface PlanParentPair {
  plan: {
    number: number;
    title: string;
    url: string;
    state: string;
    status: string | null;
  };
  parent: {
    number: number;
    title: string;
    url: string;
    state: string;
    status: string | null;
  };
}

/**
 * 計画 Issue と親 Issue のステータス不整合を検出する Pure function。
 *
 * - P1 (error): 計画 = Backlog/Approved + 親 = In progress/Review
 * - P2a (warning): 計画 = In progress + 親 = Review
 * - P3 (error): 計画 = OPEN + 親 = Done/CLOSED
 */
export function classifyPlanParentInconsistencies(
  pairs: PlanParentPair[]
): Inconsistency[] {
  const inconsistencies: Inconsistency[] = [];

  for (const { plan, parent } of pairs) {
    const planStatus = plan.status;
    const parentStatus = parent.status;

    // #2531: 6 値モデルでは Backlog / ToDo / Approved (LEGACY → Done) を含める
    // 計画 Issue がこれらの未完了 Status のままで親が In progress / Review なら不整合
    if (
      (planStatus === STATUS_VALUES.BACKLOG ||                  // 新正規値（#2531）
        planStatus === STATUS_VALUES.TODO ||
        planStatus === LEGACY_STATUS_VALUES.APPROVED_LEGACY) && // "Approved" LEGACY → Done
      (parentStatus === STATUS_VALUES.IN_PROGRESS || parentStatus === STATUS_VALUES.REVIEW)
    ) {
      inconsistencies.push({
        number: plan.number,
        title: plan.title,
        url: plan.url,
        issueState: plan.state,
        projectStatus: planStatus,
        severity: "error",
        description: `P1: 計画 Issue #${plan.number} は ${planStatus ?? "null"} ですが親 Issue #${parent.number} は ${parentStatus ?? "null"} です（計画 Issue を In Progress に遷移してください）`,
        metadata: {
          pattern: "P1",
          parentNumber: String(parent.number),
          parentStatus: parentStatus ?? "",
          fixAction: "plan-to-in-progress",
        },
      });
      continue;
    }

    if (planStatus === STATUS_VALUES.IN_PROGRESS && parentStatus === STATUS_VALUES.REVIEW) {
      inconsistencies.push({
        number: plan.number,
        title: plan.title,
        url: plan.url,
        issueState: plan.state,
        projectStatus: planStatus,
        severity: "warning",
        description: `P2a: 計画 Issue #${plan.number} は ${planStatus} ですが親 Issue #${parent.number} は Review です（syncParentStatus で親を再導出します）`,
        metadata: {
          pattern: "P2a",
          parentNumber: String(parent.number),
          parentStatus: parentStatus ?? "",
          fixAction: "sync-parent",
        },
      });
      continue;
    }

    if (
      plan.state === "OPEN" &&
      (parentStatus === STATUS_VALUES.DONE || parent.state === "CLOSED")
    ) {
      inconsistencies.push({
        number: plan.number,
        title: plan.title,
        url: plan.url,
        issueState: plan.state,
        projectStatus: planStatus,
        severity: "error",
        description: `P3: 計画 Issue #${plan.number} が OPEN のまま親 Issue #${parent.number} が ${parentStatus ?? parent.state} です（計画 Issue を Done + Close してください）`,
        metadata: {
          pattern: "P3",
          parentNumber: String(parent.number),
          parentStatus: parentStatus ?? "",
          fixAction: "plan-to-done-close",
        },
      });
    }
  }

  return inconsistencies;
}
