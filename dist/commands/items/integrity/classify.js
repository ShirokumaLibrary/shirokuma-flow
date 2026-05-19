/**
 * integrity classify - Pure function 群 (#1839)
 *
 * Issue/PR/メトリクス/親ステータスの不整合を分類する Pure function を集約。
 * API 呼び出しなし、完全にテスト可能。
 */
import { DEFAULT_EXCLUDE_STATUSES } from "../shared/session-utils.js";
import { WORK_STARTED_STATUSES, PR_VALID_STATUSES, STATUS_VALUES, LEGACY_STATUS_VALUES, isCancelledEquivalent } from "../../../utils/status-workflow.js";
import { deriveExpectedParentStatus, isPlanIssueFromLabels } from "../../../utils/parent-status.js";
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
export function classifyOrphanedPlanIssues(openIssues, childrenOfOpenParents) {
    const inconsistencies = [];
    for (const issue of openIssues) {
        if (!isPlanIssueFromLabels(issue.labels, issue.title))
            continue;
        if (childrenOfOpenParents.has(issue.number))
            continue;
        inconsistencies.push({
            number: issue.number,
            title: issue.title,
            url: issue.url,
            issueState: issue.state,
            projectStatus: issue.status,
            severity: "info",
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
 * autoSetTimestamps が全要素に書き込むため、整合性チェックも全要素を対象にする。
 */
export function getAllMappingValues(value) {
    if (!value)
        return [];
    return Array.isArray(value) ? value : [value];
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
export function classifyInconsistencies(issues, doneStatuses = DEFAULT_EXCLUDE_STATUSES, childrenOfOpenParents) {
    const inconsistencies = [];
    for (const issue of issues) {
        const status = issue.status ?? "";
        const isDoneStatus = doneStatuses.includes(status);
        // OPEN Issue が Done/Released ステータス
        if (issue.state === "OPEN" && isDoneStatus) {
            // ADR-v3-013: 親が Open の子 Issue の Done(Open) は連動 Close 待ちの中間状態
            if (childrenOfOpenParents?.has(issue.number))
                continue;
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
            inconsistencies.push({
                number: issue.number,
                title: issue.title,
                url: issue.url,
                issueState: issue.state,
                projectStatus: issue.status,
                severity: isWorkStarted ? "error" : "info",
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
export function classifyPrInconsistencies(prs) {
    const inconsistencies = [];
    for (const pr of prs) {
        const status = pr.status ?? "";
        if (!status)
            continue;
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
 * 検出パターン:
 * 1. Done/Released Issue で End at タイムスタンプが欠落 → info
 * 2. In Progress が長期間続いている → info (ステイル)
 * 3. In Progress Issue で Start at タイムスタンプが欠落 → warning
 * 4. Review Issue で Review at タイムスタンプが欠落 → warning
 */
export function classifyMetricsInconsistencies(issues, textFieldValues, metricsConfig, now) {
    const inconsistencies = [];
    const currentTime = now ?? new Date();
    const mapping = metricsConfig.statusToDateMapping ?? {};
    const staleThreshold = metricsConfig.staleThresholdDays ?? 14;
    // ステータスごとのタイムスタンプ欠落チェック定義（ループ外で1回だけ生成）
    const timestampChecks = [
        { statusValue: STATUS_VALUES.DONE, mappingKey: "Done", severity: "info" },
        { statusValue: STATUS_VALUES.IN_PROGRESS, mappingKey: LEGACY_STATUS_VALUES.IN_PROGRESS_LEGACY, severity: "warning" },
        { statusValue: STATUS_VALUES.REVIEW, mappingKey: "Review", severity: "warning" },
    ];
    for (const issue of issues) {
        const status = issue.status ?? "";
        const itemId = issue.projectItemId;
        if (!itemId)
            continue;
        const textValues = textFieldValues[itemId] ?? {};
        for (const check of timestampChecks) {
            if (status !== check.statusValue)
                continue;
            const fields = getAllMappingValues(mapping[check.mappingKey]);
            for (const field of fields) {
                if (!textValues[field]) {
                    inconsistencies.push({
                        number: issue.number,
                        title: issue.title,
                        url: issue.url,
                        issueState: issue.state,
                        projectStatus: issue.status,
                        severity: check.severity,
                        description: `Metrics: Missing '${field}' timestamp for ${status} issue`,
                        metadata: { missingField: field },
                    });
                }
            }
        }
        // In Progress がステイル（配列内の最初に見つかったタイムスタンプで判定）
        if (status === STATUS_VALUES.IN_PROGRESS) {
            const inProgressAtFields = getAllMappingValues(mapping[LEGACY_STATUS_VALUES.IN_PROGRESS_LEGACY]);
            const firstTimestamp = inProgressAtFields
                .map((f) => textValues[f])
                .find((v) => v !== undefined);
            if (firstTimestamp) {
                const inProgressAt = new Date(firstTimestamp);
                if (!isNaN(inProgressAt.getTime())) {
                    const daysSinceStart = Math.floor((currentTime.getTime() - inProgressAt.getTime()) / (1000 * 60 * 60 * 24));
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
export function classifyPrBaseBranchInconsistencies(prs, issues) {
    const inconsistencies = [];
    const subIssueNumberSet = new Set();
    for (const issue of issues) {
        if (issue.parentNumber !== undefined)
            subIssueNumberSet.add(issue.number);
    }
    for (const pr of prs) {
        if (pr.state !== "OPEN")
            continue;
        if (pr.baseBranch !== "develop")
            continue;
        const closingNumbers = pr.closingIssueNumbers ?? [];
        const subIssueNumbers = closingNumbers.filter((num) => subIssueNumberSet.has(num));
        if (subIssueNumbers.length === 0)
            continue;
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
export function classifyParentStatusInconsistencies(parents) {
    const inconsistencies = [];
    for (const parent of parents) {
        if (parent.subIssueStatuses.length === 0)
            continue;
        if (!parent.projectItemId)
            continue;
        const expectedStatus = deriveExpectedParentStatus(parent.subIssueStatuses);
        if (!expectedStatus)
            continue;
        if (parent.currentStatus !== expectedStatus) {
            // 親が Done で子に Open がある場合は重大な不整合として error に昇格
            const severity = parent.currentStatus === STATUS_VALUES.DONE ? "error" : "info";
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
export function classifyBlockedWithOpenPrInconsistencies(issues, prs) {
    const inconsistencies = [];
    // OPEN かつ Blocked の Issue セットを構築
    const blockedIssueMap = new Map();
    for (const issue of issues) {
        if (issue.state === "OPEN" && issue.status === STATUS_VALUES.BLOCKED) {
            blockedIssueMap.set(issue.number, issue);
        }
    }
    if (blockedIssueMap.size === 0)
        return inconsistencies;
    // OPEN PR からリンク先 Issue に Blocked のものがあれば警告
    for (const pr of prs) {
        if (pr.state !== "OPEN")
            continue;
        const closingNumbers = pr.closingIssueNumbers ?? [];
        for (const issueNum of closingNumbers) {
            const issue = blockedIssueMap.get(issueNum);
            if (!issue)
                continue;
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
//# sourceMappingURL=classify.js.map