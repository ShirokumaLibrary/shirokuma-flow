/**
 * items integrity - Issue 状態と Project Status の整合性チェック (#1823)
 *
 * Issue 状態と Project Status の不整合を検出・修正する:
 * - OPEN Issue が Done/Released ステータス → close
 * - CLOSED Issue がアクティブステータス → Done に更新
 * - メトリクス: タイムスタンプ欠落・ステイル Issue
 * - Automation 設定確認
 */
import { runGraphQL, getRepoInfo, } from "../../../utils/github.js";
import { loadGhConfig, getDefaultLimit, getMetricsConfig, } from "../../../utils/gh-config.js";
import { getProjectFields, updateTextField, generateTimestamp, } from "../../../utils/project-fields.js";
import { deriveExpectedParentStatus, extractSubIssueStatuses, isPlanIssue } from "../../../utils/parent-status.js";
import { STATUS_VALUES } from "../../../utils/status-workflow.js";
import { getProjectId, fetchWorkflows, RECOMMENDED_WORKFLOWS, } from "../../../utils/project-utils.js";
import { validateGitHubSetup, printSetupCheckResults, } from "../../../utils/setup-check.js";
import { cmdSetupMetrics } from "../../projects/setup-metrics.js";
import { GRAPHQL_MUTATION_CLOSE_ISSUE, } from "../../../utils/graphql-queries.js";
import { getIssueId, GRAPHQL_QUERY_SUB_ISSUES, SUB_ISSUES_GRAPHQL_HEADERS, } from "../helpers.js";
import { fetchActiveIssues, updateIssueStatus, } from "../shared/session-utils.js";
import { rebuildOpenIssuesIndex } from "../../../utils/github-cache.js";
import { classifyInconsistencies, classifyOrphanedPlanIssues, classifyPrInconsistencies, classifyPrBaseBranchInconsistencies, classifyMetricsInconsistencies, classifyParentStatusInconsistencies, classifyBlockedWithOpenPrInconsistencies, } from "./classify.js";
// =============================================================================
// fetchPrsWithProjectStatus - PR + Project Status 取得
// =============================================================================
const GRAPHQL_QUERY_PRS_WITH_PROJECT_STATUS = `
query($owner: String!, $name: String!, $first: Int!, $states: [PullRequestState!]) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: $first, states: $states, orderBy: {field: CREATED_AT, direction: DESC}) {
      nodes {
        number
        title
        url
        state
        baseRefName
        closingIssuesReferences(first: 10) {
          nodes {
            number
          }
        }
        projectItems(first: 5) {
          nodes {
            id
            project { id title }
            status: fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue { name }
            }
          }
        }
      }
    }
  }
}
`;
/**
 * PR を Project Status 付きで取得する。
 */
export async function fetchPrsWithProjectStatus(owner, repo, limit = 50) {
    const result = await runGraphQL(GRAPHQL_QUERY_PRS_WITH_PROJECT_STATUS, {
        owner,
        name: repo,
        first: limit,
        states: ["OPEN", "MERGED", "CLOSED"],
    });
    if (!result.success)
        return [];
    const nodes = result.data?.data?.repository?.pullRequests?.nodes ?? [];
    return nodes
        .filter((n) => !!n?.number)
        .map((n) => {
        const projectItems = n.projectItems?.nodes ?? [];
        const matchingItem = projectItems.find((p) => p?.project?.title === repo) ?? projectItems[0];
        const closingIssueNumbers = (n.closingIssuesReferences?.nodes ?? [])
            .map((node) => node?.number)
            .filter((num) => typeof num === "number");
        return {
            number: n.number,
            title: n.title ?? "",
            url: n.url ?? "",
            state: n.state ?? "OPEN",
            status: matchingItem?.status?.name ?? null,
            projectItemId: matchingItem?.id ?? null,
            projectId: matchingItem?.project?.id ?? null,
            baseBranch: n.baseRefName ?? null,
            closingIssueNumbers,
        };
    })
        .filter((pr) => pr.projectItemId !== null);
}
// =============================================================================
// Metrics helpers
// =============================================================================
/** プロジェクト内の全アイテムの Text フィールド値を一括取得するクエリ（ページネーション対応） */
const GRAPHQL_QUERY_PROJECT_ITEM_TEXT_VALUES = `
query($projectId: ID!, $first: Int!, $after: String) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldTextValue {
                text
                field { ... on ProjectV2Field { name } }
              }
            }
          }
        }
      }
    }
  }
}
`;
/**
 * プロジェクト内の全アイテムの Text フィールド値を一括取得する。
 * itemId → { fieldName → textValue } のマップを返す。
 */
export async function fetchItemTextFieldValues(projectId) {
    const itemMap = {};
    let cursor = null;
    // ページネーション: 100 件ずつ取得し、全ページを走査
    for (;;) {
        const result = await runGraphQL(GRAPHQL_QUERY_PROJECT_ITEM_TEXT_VALUES, {
            projectId,
            first: 100,
            after: cursor,
        });
        if (!result.success)
            break;
        const itemsData = result.data?.data?.node?.items;
        const items = itemsData?.nodes ?? [];
        for (const item of items) {
            if (!item?.id)
                continue;
            const textValues = {};
            const fieldValues = item.fieldValues?.nodes ?? [];
            for (const fv of fieldValues) {
                if (fv?.field?.name && fv?.text) {
                    textValues[fv.field.name] = fv.text;
                }
            }
            if (Object.keys(textValues).length > 0) {
                itemMap[item.id] = textValues;
            }
        }
        const hasNextPage = itemsData?.pageInfo?.hasNextPage ?? false;
        if (!hasNextPage)
            break;
        cursor = itemsData?.pageInfo?.endCursor ?? null;
        if (!cursor)
            break;
    }
    return itemMap;
}
// =============================================================================
// fetchStatusTransitionTimestamp - Timeline API によるステータス遷移時刻取得
// =============================================================================
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
export async function fetchStatusTransitionTimestamp(owner, repo, issueNumber, targetStatus, logger) {
    const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          timelineItems(first: 100, itemTypes: [PROJECT_V2_ITEM_STATUS_CHANGED_EVENT]) {
            nodes {
              ... on ProjectV2ItemStatusChangedEvent {
                createdAt
                status
              }
            }
          }
        }
      }
    }
  `;
    const result = await runGraphQL(query, {
        owner,
        repo,
        number: issueNumber,
    });
    if (!result.success) {
        logger.debug(`Timeline GraphQL error for #${issueNumber}: ${result.error}`);
        return null;
    }
    const nodes = result.data?.data?.repository?.issue?.timelineItems?.nodes ?? [];
    for (const node of nodes) {
        if (node.status === targetStatus && node.createdAt) {
            logger.debug(`Timeline: Found '${targetStatus}' transition at ${node.createdAt} for #${issueNumber}`);
            return node.createdAt;
        }
    }
    logger.debug(`Timeline: No '${targetStatus}' transition found for #${issueNumber}`);
    return null;
}
// =============================================================================
// fetchParentSubIssueSummaries - 親 Issue の Sub-Issue ステータス取得
// =============================================================================
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
export async function fetchParentSubIssueSummaries(openIssues, owner, repo, logger) {
    // 全 OPEN Issue の Sub-Issue を並列取得（N+1 → 並列バッチ化）
    const results = await Promise.all(openIssues.map(async (issue) => {
        const result = await runGraphQL(GRAPHQL_QUERY_SUB_ISSUES, { owner, name: repo, number: issue.number }, { headers: SUB_ISSUES_GRAPHQL_HEADERS });
        if (!result.success) {
            logger.debug(`Failed to fetch sub-issues for #${issue.number}`);
            return null;
        }
        const subIssuesData = result.data?.data?.repository?.issue;
        const totalCount = subIssuesData?.subIssuesSummary?.total ?? 0;
        if (totalCount === 0)
            return null;
        const subIssueNodes = subIssuesData?.subIssues?.nodes ?? [];
        const childNumbers = subIssueNodes
            .map((n) => n?.number)
            .filter((n) => typeof n === "number");
        // area:plan ラベルの計画 Issue をステータス集計から除外
        const filteredNodes = subIssueNodes.filter((node) => !isPlanIssue(node));
        const subIssueStatuses = extractSubIssueStatuses(filteredNodes);
        const summary = subIssueStatuses.length === 0
            ? null
            : {
                number: issue.number,
                title: issue.title,
                url: issue.url,
                currentStatus: issue.status,
                projectItemId: issue.projectItemId,
                projectId: issue.projectId,
                subIssueStatuses,
            };
        return { summary, childNumbers };
    }));
    const summaries = [];
    const childrenOfOpenParents = new Set();
    for (const r of results) {
        if (r === null)
            continue;
        if (r.summary)
            summaries.push(r.summary);
        for (const n of r.childNumbers)
            childrenOfOpenParents.add(n);
    }
    return { summaries, childrenOfOpenParents };
}
// =============================================================================
// Helper: Issue を ID で close
// =============================================================================
export async function closeIssueById(issueId) {
    const result = await runGraphQL(GRAPHQL_MUTATION_CLOSE_ISSUE, {
        issueId,
        stateReason: "COMPLETED",
    });
    return result.success;
}
// =============================================================================
// cmdIntegrity - メイン処理
// =============================================================================
/**
 * Issue 状態と Project Status の整合性をチェックし、オプションで修正する。
 */
export async function cmdIntegrity(options, logger) {
    // --setup モード: GitHub 手動設定の検証
    if (options.setup) {
        const setupResult = await validateGitHubSetup(logger);
        if (!setupResult)
            return 1;
        printSetupCheckResults(setupResult, logger);
        console.log(JSON.stringify(setupResult, null, 2));
        // --fix フラグが指定されており欠落フィールドがある場合、cmdSetupMetrics で自動作成する
        if (options.fix && setupResult.summary.missing > 0) {
            logger.info("metrics フィールドを自動作成します (--fix)");
            const setupMetricsResult = await cmdSetupMetrics({ owner: options.owner }, logger);
            if (setupMetricsResult !== 0) {
                logger.warn("metrics フィールド作成に失敗しました");
                return 1;
            }
            // 自動作成後に再チェックして結果を表示する
            const reCheckResult = await validateGitHubSetup(logger);
            if (reCheckResult) {
                printSetupCheckResults(reCheckResult, logger);
                console.log(JSON.stringify(reCheckResult, null, 2));
                return reCheckResult.summary.missing > 0 ? 1 : 0;
            }
        }
        return setupResult.summary.missing > 0 ? 1 : 0;
    }
    const config = loadGhConfig();
    const repoInfo = getRepoInfo();
    if (!repoInfo) {
        logger.error("Could not determine repository");
        return 1;
    }
    const { owner: repoOwner, name: repo } = repoInfo;
    const owner = options.owner || repoOwner;
    const limit = getDefaultLimit(config);
    logger.debug(`Repository: ${owner}/${repo}`);
    // 1. Issue + PR を並列取得
    const [allIssues, prs] = await Promise.all([
        fetchActiveIssues(owner, repo, limit, ["OPEN", "CLOSED"]),
        fetchPrsWithProjectStatus(owner, repo, limit),
    ]);
    logger.debug(`Issues fetched: ${allIssues.length}, PRs fetched: ${prs.length}`);
    // 2. OPEN 親の子 Issue サマリーを取得（ADR-v3-013 例外ルール用セットも同時取得）
    const openIssues = allIssues.filter((i) => i.state === "OPEN");
    const { summaries: parentSummaries, childrenOfOpenParents } = await fetchParentSubIssueSummaries(openIssues, owner, repo, logger);
    // 3. 不整合を分類 (pure function)
    const inconsistencies = classifyInconsistencies(allIssues, undefined, childrenOfOpenParents);
    logger.debug(`Inconsistencies found: ${inconsistencies.length}`);
    const prInconsistencies = classifyPrInconsistencies(prs);
    logger.debug(`PR inconsistencies: ${prInconsistencies.length}`);
    inconsistencies.push(...prInconsistencies);
    // PR ベースブランチ不整合チェック: OPEN PR が develop ベースでリンク先がサブ Issue
    const prBaseBranchInconsistencies = classifyPrBaseBranchInconsistencies(prs, allIssues);
    logger.debug(`PR base branch inconsistencies: ${prBaseBranchInconsistencies.length}`);
    inconsistencies.push(...prBaseBranchInconsistencies);
    // Blocked Issue に OPEN PR がリンクされているチェック（Workflow #6 が Blocked → In progress に上書きする可能性を事前警告）
    const blockedWithOpenPrInconsistencies = classifyBlockedWithOpenPrInconsistencies(openIssues, prs);
    logger.debug(`Blocked+OpenPR inconsistencies: ${blockedWithOpenPrInconsistencies.length}`);
    inconsistencies.push(...blockedWithOpenPrInconsistencies);
    if (parentSummaries.length > 0) {
        const parentInconsistencies = classifyParentStatusInconsistencies(parentSummaries);
        logger.debug(`Parent status inconsistencies: ${parentInconsistencies.length}`);
        inconsistencies.push(...parentInconsistencies);
    }
    const orphanedPlanInconsistencies = classifyOrphanedPlanIssues(openIssues, childrenOfOpenParents);
    logger.debug(`Orphaned plan issues: ${orphanedPlanInconsistencies.length}`);
    inconsistencies.push(...orphanedPlanInconsistencies);
    // 4. --fix が指定された場合、修正を実行
    const fixes = [];
    const projectFieldsCache = {};
    if (options.fix && inconsistencies.length > 0) {
        const errorItems = inconsistencies.filter((i) => i.severity === "error");
        // PR の番号セット（Issues --fix ループで PR を誤処理しないよう除外する）
        const prNumberSet = new Set(prs.map((p) => p.number));
        for (const item of errorItems) {
            // PR 専用ループ（後述）で処理するためスキップ
            if (prNumberSet.has(item.number))
                continue;
            if (item.issueState === "OPEN") {
                // OPEN + Done/Released → Issue をクローズ
                logger.info(`Closing #${item.number}: ${item.description}`);
                const issueId = await getIssueId(owner, repo, item.number);
                if (!issueId) {
                    fixes.push({
                        number: item.number,
                        action: "close",
                        success: false,
                        error: "Could not resolve issue ID",
                    });
                    continue;
                }
                const success = await closeIssueById(issueId);
                fixes.push({
                    number: item.number,
                    action: "close",
                    success,
                    error: success ? undefined : "GraphQL mutation failed",
                });
                if (success) {
                    logger.success(`Closed #${item.number}`);
                }
                else {
                    logger.error(`Failed to close #${item.number}`);
                }
            }
            else if (item.issueState === "CLOSED") {
                // CLOSED + アクティブステータス → Done に更新
                logger.info(`Updating #${item.number} status to Done: ${item.description}`);
                const issueData = allIssues.find((i) => i.number === item.number);
                if (!issueData?.projectItemId || !issueData?.projectId) {
                    fixes.push({
                        number: item.number,
                        action: "update-status",
                        success: false,
                        error: "Could not resolve project item ID",
                    });
                    continue;
                }
                if (!projectFieldsCache[issueData.projectId]) {
                    projectFieldsCache[issueData.projectId] = await getProjectFields(issueData.projectId);
                }
                const fields = projectFieldsCache[issueData.projectId];
                const success = await updateIssueStatus(issueData.projectId, issueData.projectItemId, "Done", fields, logger, issueData.status ?? undefined);
                fixes.push({
                    number: item.number,
                    action: "update-status",
                    success,
                    error: success ? undefined : "Failed to update project status",
                });
                if (success) {
                    logger.success(`Updated #${item.number} status to Done`);
                }
                else {
                    logger.error(`Failed to update #${item.number} status`);
                }
            }
        }
        // MERGED → Done、CLOSED（非マージ）→ Cancelled。
        // prs は fetchPrsWithProjectStatus の戻り値なので projectItemId/projectId を
        // 直接参照できる（allIssues は Issues のみのため PR には使えない）。
        const prErrorItems = prInconsistencies.filter((i) => i.severity === "error" && (i.issueState === "MERGED" || i.issueState === "CLOSED") && i.projectStatus === "Review");
        for (const item of prErrorItems) {
            const prData = prs.find((p) => p.number === item.number);
            if (!prData?.projectItemId || !prData?.projectId) {
                fixes.push({
                    number: item.number,
                    action: "update-pr-status",
                    success: false,
                    error: "Could not resolve PR project item ID",
                });
                continue;
            }
            // CLOSED PR も Done（state_reason: not_planned で識別）
            const targetStatus = STATUS_VALUES.DONE;
            logger.info(`Updating PR #${item.number} status to ${targetStatus}: ${item.description}`);
            if (!projectFieldsCache[prData.projectId]) {
                projectFieldsCache[prData.projectId] = await getProjectFields(prData.projectId);
            }
            const fields = projectFieldsCache[prData.projectId];
            const success = await updateIssueStatus(prData.projectId, prData.projectItemId, targetStatus, fields, logger, prData.status ?? undefined);
            fixes.push({
                number: item.number,
                action: "update-pr-status",
                success,
                error: success ? undefined : "Failed to update PR project status",
            });
            if (success) {
                logger.success(`Updated PR #${item.number} status to ${targetStatus}`);
            }
            else {
                logger.error(`Failed to update PR #${item.number} status`);
            }
        }
        // 親ステータス不整合の修正: parentSummaries から期待ステータスを直接導出
        for (const summary of parentSummaries) {
            if (!summary.projectItemId || !summary.projectId)
                continue;
            const targetStatus = deriveExpectedParentStatus(summary.subIssueStatuses);
            if (!targetStatus || summary.currentStatus === targetStatus)
                continue;
            logger.info(`Updating parent #${summary.number} status to ${targetStatus}`);
            if (!projectFieldsCache[summary.projectId]) {
                projectFieldsCache[summary.projectId] = await getProjectFields(summary.projectId);
            }
            const fields = projectFieldsCache[summary.projectId];
            const success = await updateIssueStatus(summary.projectId, summary.projectItemId, targetStatus, fields, logger, summary.currentStatus ?? undefined);
            fixes.push({
                number: summary.number,
                action: "update-parent-status",
                success,
                error: success ? undefined : "Failed to update parent status",
            });
            if (success) {
                logger.success(`Updated parent #${summary.number} status to ${targetStatus}`);
            }
            else {
                logger.error(`Failed to update parent #${summary.number} status`);
            }
        }
    }
    // 5. メトリクスチェック
    const metricsConfig = getMetricsConfig(config);
    if (metricsConfig.enabled) {
        logger.debug("Metrics check enabled");
        const projectIds = new Set();
        for (const issue of allIssues) {
            if (issue.projectId)
                projectIds.add(issue.projectId);
        }
        const allTextFieldValues = {};
        for (const pid of projectIds) {
            const values = await fetchItemTextFieldValues(pid);
            Object.assign(allTextFieldValues, values);
        }
        const metricsIssues = classifyMetricsInconsistencies(allIssues, allTextFieldValues, metricsConfig);
        logger.debug(`Metrics inconsistencies: ${metricsIssues.length}`);
        inconsistencies.push(...metricsIssues);
        if (options.fix && metricsIssues.length > 0) {
            for (const item of metricsIssues) {
                const missingField = item.metadata?.missingField;
                if (!missingField)
                    continue;
                const issueData = allIssues.find((i) => i.number === item.number);
                if (!issueData?.projectItemId || !issueData?.projectId)
                    continue;
                if (!projectFieldsCache[issueData.projectId]) {
                    projectFieldsCache[issueData.projectId] = await getProjectFields(issueData.projectId);
                }
                const pf = projectFieldsCache[issueData.projectId];
                const fieldInfo = pf[missingField];
                if (!fieldInfo || fieldInfo.type !== "TEXT")
                    continue;
                // タイムスタンプの決定（設計意図）:
                // - warning（In Progress/Review の欠落）: Timeline API → 現在時刻フォールバック
                //   ∵ ステータス遷移時刻が最も正確な補正値。Projects V2 では REST Timeline API が
                //     機能しないため現在時刻がベストエフォートの近似値となる
                // - info（Done の欠落）: closedAt → 現在時刻フォールバック
                //   ∵ Done 遷移は Issue の close と同期するため closedAt が正確な近似値。
                //   Timeline API を試行しない理由: closedAt のほうが確実かつ API 呼び出しを節約できる
                let ts;
                if (item.severity === "warning" && item.projectStatus) {
                    // Timeline API から遷移時刻を取得
                    const timelineTs = await fetchStatusTransitionTimestamp(owner, repo, item.number, item.projectStatus, logger);
                    if (timelineTs) {
                        ts = timelineTs;
                        logger.debug(`Timeline: Using transition timestamp ${ts} for #${item.number} (${item.projectStatus})`);
                    }
                    else {
                        ts = generateTimestamp();
                        logger.warn(`Timeline: Could not retrieve transition timestamp for #${item.number} (${item.projectStatus}), using current time`);
                    }
                }
                else {
                    ts = issueData.closedAt ?? generateTimestamp();
                }
                const success = await updateTextField(issueData.projectId, issueData.projectItemId, fieldInfo.id, ts);
                fixes.push({
                    number: item.number,
                    action: "backfill-timestamp",
                    success,
                    error: success ? undefined : "Failed to set Text field",
                });
                if (success) {
                    logger.success(`Backfilled ${missingField} for #${item.number} (${ts})`);
                }
                else {
                    logger.error(`Failed to backfill ${missingField} for #${item.number}`);
                }
            }
        }
    }
    // 6. --fix 後に open-issues インデックスをリビルド
    if (options.fix && fixes.some((f) => f.success)) {
        rebuildOpenIssuesIndex(owner, repo);
        logger.info("open-issues インデックスを再構築しました");
    }
    // 7. Automation ステータスチェック
    let automationStatus;
    const projectId = await getProjectId(owner);
    if (projectId) {
        const workflows = await fetchWorkflows(projectId);
        if (workflows.length > 0) {
            const workflowSummary = workflows.map((w) => ({
                name: w.name,
                enabled: w.enabled,
                recommended: RECOMMENDED_WORKFLOWS.includes(w.name),
            }));
            const missingRecommended = workflowSummary
                .filter((w) => w.recommended && !w.enabled)
                .map((w) => w.name);
            automationStatus = {
                checked: true,
                workflows: workflowSummary,
                missing_recommended: missingRecommended,
            };
            if (missingRecommended.length > 0) {
                logger.warn(`Recommended automations disabled: ${missingRecommended.join(", ")}`);
                logger.info("Enable via: GitHub Project Settings > Workflows");
            }
            else {
                logger.debug("All recommended automations are enabled");
            }
        }
    }
    // 8. 出力ビルド
    const output = {
        repository: `${owner}/${repo}`,
        inconsistencies,
        fixes,
        automations: automationStatus,
        summary: {
            total: allIssues.length,
            warnings: inconsistencies.length,
            fixed: fixes.filter((f) => f.success).length,
            fix_failures: fixes.filter((f) => !f.success).length,
            children_of_open_parents: childrenOfOpenParents.size,
            orphaned_plan_issues: orphanedPlanInconsistencies.length,
        },
    };
    console.log(JSON.stringify(output, null, 2));
    if (output.summary.fix_failures > 0)
        return 1;
    if (!options.fix && output.summary.warnings > 0)
        return 1;
    return 0;
}
//# sourceMappingURL=index.js.map