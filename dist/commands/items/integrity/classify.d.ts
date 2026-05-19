/**
 * integrity classify - Pure function 群 (#1839)
 *
 * Issue/PR/メトリクス/親ステータスの不整合を分類する Pure function を集約。
 * API 呼び出しなし、完全にテスト可能。
 */
import type { IssueData } from "../shared/session-utils.js";
import type { MetricsConfig } from "../../../utils/gh-config.js";
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
export declare function classifyOrphanedPlanIssues(openIssues: IssueData[], childrenOfOpenParents: Set<number>): Inconsistency[];
/**
 * statusToDateMapping の値を配列に正規化する。
 * 文字列の場合は単一要素の配列に、配列の場合はそのまま返す。
 * autoSetTimestamps が全要素に書き込むため、整合性チェックも全要素を対象にする。
 */
export declare function getAllMappingValues(value: string | string[] | undefined): string[];
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
export declare function classifyInconsistencies(issues: IssueData[], doneStatuses?: readonly string[], childrenOfOpenParents?: Set<number>): Inconsistency[];
/**
 * PR のステータス不整合を分類する。
 * Pure function - API 呼び出しなし、完全にテスト可能。
 *
 * 検出パターン:
 * 1. OPEN PR が Done ステータス → error
 * 2. MERGED/CLOSED PR がアクティブステータス (In Progress/Review) → error
 * 3. PR に Issue 専用ステータスが設定されている → error
 */
export declare function classifyPrInconsistencies(prs: PrData[]): Inconsistency[];
/**
 * メトリクス関連の不整合を分類する。
 * Pure function - API 呼び出しなし。
 *
 * 検出パターン:
 * 1. Done/Released Issue で End at タイムスタンプが欠落 → info
 * 2. In Progress が長期間続いている → info (ステイル)
 * 3. In Progress Issue で Start at タイムスタンプが欠落 → warning
 * 4. Review Issue で Review at タイムスタンプが欠落 → warning
 */
export declare function classifyMetricsInconsistencies(issues: IssueData[], textFieldValues: Record<string, Record<string, string>>, metricsConfig: MetricsConfig, now?: Date): Inconsistency[];
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
export declare function classifyPrBaseBranchInconsistencies(prs: PrData[], issues: IssueData[]): Inconsistency[];
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
export declare function classifyParentStatusInconsistencies(parents: SubIssueSummary[]): Inconsistency[];
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
export declare function classifyBlockedWithOpenPrInconsistencies(issues: IssueData[], prs: PrData[]): Inconsistency[];
//# sourceMappingURL=classify.d.ts.map