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
import {
  runGraphQL,
  getRepoInfo,
  type GhResult,
} from "../../../utils/github.js";
import {
  loadGhConfig,
  getDefaultLimit,
  getMetricsConfig,
} from "../../../utils/gh-config.js";
import {
  getProjectFields,
  type ProjectField,
} from "../../../utils/project-fields.js";
import { deriveExpectedParentStatus, extractSubIssueStatuses, findPlanIssue, isPlanIssue, syncParentStatus, type SubIssueNode } from "../../../utils/parent-status.js";
import { STATUS_VALUES, LEGACY_STATUS_VALUES } from "../../../utils/status-workflow.js";
import {
  getProjectId,
  fetchWorkflowsWithProject,
  RECOMMENDED_WORKFLOWS,
  type ProjectWorkflow,
} from "../../../utils/project-utils.js";
import {
  validateGitHubSetup,
  printSetupCheckResults,
} from "../../../utils/setup-check.js";
import { cmdSetupMetrics } from "../../project/setup-metrics.js";
import {
  GRAPHQL_MUTATION_CLOSE_ISSUE,
} from "../../../utils/graphql-queries.js";
import {
  getIssueId,
  GRAPHQL_QUERY_SUB_ISSUES,
  SUB_ISSUES_GRAPHQL_HEADERS,
} from "../helpers.js";
import {
  type IssueData,
  fetchActiveIssues,
  updateIssueStatus,
} from "../shared/session-utils.js";
import { rebuildOpenIssuesIndex } from "../../../utils/github-cache.js";
import {
  type Inconsistency,
  type PrData,
  type SubIssueSummary,
  type PlanParentPair,
  classifyInconsistencies,
  classifyOrphanedPlanIssues,
  classifyPrInconsistencies,
  classifyPrBaseBranchInconsistencies,
  classifyMetricsInconsistencies,
  classifyParentStatusInconsistencies,
  classifyBlockedWithOpenPrInconsistencies,
  classifyApprovedInconsistencies,
  classifyPlanParentInconsistencies,
} from "./classify.js";

export type { IssueData };
export type { Inconsistency, InconsistencySeverity, PrData, SubIssueSummary, PlanParentPair } from "./classify.js";

// =============================================================================
// Options
// =============================================================================

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
  workflows: Array<{ name: string; enabled: boolean; recommended: boolean }>;
  missing_recommended: string[];
  /** 無効化された推奨 workflow がある場合の deep-link（#2325） */
  workflows_settings_url?: string;
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
export async function fetchPrsWithProjectStatus(
  owner: string,
  repo: string,
  limit: number = 50
): Promise<PrData[]> {
  interface PrNode {
    number?: number;
    title?: string;
    url?: string;
    state?: string;
    baseRefName?: string;
    closingIssuesReferences?: {
      nodes?: Array<{ number?: number }>;
    };
    projectItems?: {
      nodes?: Array<{
        id?: string;
        project?: { id?: string; title?: string };
        status?: { name?: string } | null;
      }>;
    };
  }

  interface QueryResult {
    data?: {
      repository?: {
        pullRequests?: {
          nodes?: PrNode[];
        };
      };
    };
  }

  const result = await runGraphQL<QueryResult>(GRAPHQL_QUERY_PRS_WITH_PROJECT_STATUS, {
    owner,
    name: repo,
    first: limit,
    states: ["OPEN", "MERGED", "CLOSED"],
  });

  if (!result.success) return [];

  const nodes = result.data?.data?.repository?.pullRequests?.nodes ?? [];
  return nodes
    .filter((n): n is PrNode & { number: number } => !!n?.number)
    .map((n) => {
      const projectItems = n.projectItems?.nodes ?? [];
      const matchingItem = projectItems.find((p) => p?.project?.title === repo) ?? projectItems[0];
      const closingIssueNumbers = (n.closingIssuesReferences?.nodes ?? [])
        .map((node) => node?.number)
        .filter((num): num is number => typeof num === "number");
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
export async function fetchItemTextFieldValues(
  projectId: string
): Promise<Record<string, Record<string, string>>> {
  interface TextValueNode {
    text?: string;
    field?: { name?: string };
  }

  interface ItemNode {
    id?: string;
    fieldValues?: {
      nodes?: TextValueNode[];
    };
  }

  interface ItemsPage {
    pageInfo?: { hasNextPage?: boolean; endCursor?: string };
    nodes?: ItemNode[];
  }

  interface QueryResult {
    data?: {
      node?: {
        items?: ItemsPage;
      };
    };
  }

  const itemMap: Record<string, Record<string, string>> = {};
  let cursor: string | null = null;

  // ページネーション: 100 件ずつ取得し、全ページを走査
  for (;;) {
    const result: GhResult<QueryResult> = await runGraphQL<QueryResult>(GRAPHQL_QUERY_PROJECT_ITEM_TEXT_VALUES, {
      projectId,
      first: 100,
      after: cursor,
    });

    if (!result.success) break;

    const itemsData: ItemsPage | undefined = result.data?.data?.node?.items;
    const items: ItemNode[] = itemsData?.nodes ?? [];

    for (const item of items) {
      if (!item?.id) continue;
      const textValues: Record<string, string> = {};
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
    if (!hasNextPage) break;
    cursor = itemsData?.pageInfo?.endCursor ?? null;
    if (!cursor) break;
  }

  return itemMap;
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
 * - `subIssueNodesByParent`: 親 Issue 番号 → サブ Issue ノード配列のマップ。
 */
export async function fetchParentSubIssueSummaries(
  openIssues: IssueData[],
  owner: string,
  repo: string,
  logger: Logger
): Promise<{
  summaries: SubIssueSummary[];
  childrenOfOpenParents: Set<number>;
  subIssueNodesByParent: Map<number, SubIssueNode[]>;
}> {
  interface SubIssuesQueryResult {
    data?: {
      repository?: {
        issue?: {
          number?: number;
          title?: string;
          subIssues?: {
            totalCount?: number;
            nodes?: SubIssueNode[];
          };
          subIssuesSummary?: {
            total?: number;
            completed?: number;
          };
        };
      };
    };
  }

  // 全 OPEN Issue の Sub-Issue を並列取得（N+1 → 並列バッチ化）
  const results = await Promise.all(
    openIssues.map(async (issue) => {
      const result = await runGraphQL<SubIssuesQueryResult>(
        GRAPHQL_QUERY_SUB_ISSUES,
        { owner, name: repo, number: issue.number },
        { headers: SUB_ISSUES_GRAPHQL_HEADERS }
      );

      if (!result.success) {
        logger.debug(`Failed to fetch sub-issues for #${issue.number}`);
        return null;
      }

      const subIssuesData = result.data?.data?.repository?.issue;
      const totalCount = subIssuesData?.subIssuesSummary?.total ?? 0;

      if (totalCount === 0) return null;

      const subIssueNodes = subIssuesData?.subIssues?.nodes ?? [];
      const childNumbers = subIssueNodes
        .map((n) => n?.number)
        .filter((n): n is number => typeof n === "number");

      // タイトルが「計画:」で始まる計画 Issue をステータス集計から除外
      const filteredNodes = subIssueNodes.filter((node) => !isPlanIssue(node));
      const subIssueStatuses = extractSubIssueStatuses(filteredNodes);

      const summary: SubIssueSummary | null =
        subIssueStatuses.length === 0
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

      return { summary, childNumbers, parentNumber: issue.number, subIssueNodes };
    })
  );

  const summaries: SubIssueSummary[] = [];
  const childrenOfOpenParents = new Set<number>();
  const subIssueNodesByParent = new Map<number, SubIssueNode[]>();
  for (const r of results) {
    if (r === null) continue;
    if (r.summary) summaries.push(r.summary);
    for (const n of r.childNumbers) childrenOfOpenParents.add(n);
    subIssueNodesByParent.set(r.parentNumber, r.subIssueNodes);
  }

  return { summaries, childrenOfOpenParents, subIssueNodesByParent };
}

// =============================================================================
// buildPlanParentPairs - 計画 Issue と親 Issue のペアを構築
// =============================================================================

export function buildPlanParentPairs(
  parentNodes: IssueData[],
  subIssueNodesByParent: Map<number, SubIssueNode[]>,
  owner: string,
  repo: string
): PlanParentPair[] {
  const pairs: PlanParentPair[] = [];

  for (const parent of parentNodes) {
    const subNodes = subIssueNodesByParent.get(parent.number) ?? [];
    const planNode = findPlanIssue(subNodes);
    if (!planNode || !planNode.number) continue;

    const planStatus =
      planNode.projectItems?.nodes
        ?.find((pi) => pi.status?.name != null)
        ?.status?.name ?? null;

    pairs.push({
      plan: {
        number: planNode.number,
        title: planNode.title ?? "",
        url: `https://github.com/${owner}/${repo}/issues/${planNode.number}`,
        state: planNode.state ?? "OPEN",
        status: planStatus,
      },
      parent: {
        number: parent.number,
        title: parent.title,
        url: parent.url,
        state: parent.state,
        status: parent.status,
      },
    });
  }

  return pairs;
}

// =============================================================================
// Helper: Issue を ID で close
// =============================================================================

/**
 * Issue を GraphQL ID で close する。
 *
 * @param issueId - Issue の GraphQL node ID
 * @param stateReason - GitHub の close 理由 (`COMPLETED` または `NOT_PLANNED`)。
 *   既定値は `COMPLETED`。`issue rollback --action cancel` のように「キャンセル」を
 *   意味する経路では呼び出し側で `NOT_PLANNED` を指定する。
 */
export async function closeIssueById(
  issueId: string,
  stateReason: "COMPLETED" | "NOT_PLANNED" = "COMPLETED"
): Promise<boolean> {
  const result = await runGraphQL(GRAPHQL_MUTATION_CLOSE_ISSUE, {
    issueId,
    stateReason,
  });
  return result.success;
}

// =============================================================================
// cmdIntegrity - メイン処理
// =============================================================================

/**
 * Issue 状態と Project Status の整合性をチェックし、オプションで修正する。
 */
export async function cmdIntegrity(
  options: IntegrityOptions,
  logger: Logger
): Promise<number> {
  // --setup モード: GitHub 手動設定の検証
  if (options.setup) {
    const setupResult = await validateGitHubSetup(logger);
    if (!setupResult) return 1;

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
  const { summaries: parentSummaries, childrenOfOpenParents, subIssueNodesByParent } =
    await fetchParentSubIssueSummaries(openIssues, owner, repo, logger);

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

  // 通常 Issue が誤って Approved に設定されているケースを検出（#2389）
  const approvedInconsistencies = classifyApprovedInconsistencies(openIssues);
  logger.debug(`Approved misset inconsistencies: ${approvedInconsistencies.length}`);
  inconsistencies.push(...approvedInconsistencies);

  const planParentPairs = buildPlanParentPairs(openIssues, subIssueNodesByParent, owner, repo);
  const planParentInconsistencies = classifyPlanParentInconsistencies(planParentPairs);
  logger.debug(`Plan-parent inconsistencies: ${planParentInconsistencies.length}`);
  inconsistencies.push(...planParentInconsistencies);

  // 4. --fix が指定された場合、修正を実行
  const fixes: FixResult[] = [];
  const projectFieldsCache: Record<string, Record<string, ProjectField>> = {};

  if (options.fix && inconsistencies.length > 0) {
    const errorItems = inconsistencies.filter((i) => i.severity === "error");
    // PR の番号セット（Issues --fix ループで PR を誤処理しないよう除外する）
    const prNumberSet = new Set(prs.map((p) => p.number));

    for (const item of errorItems) {
      // PR 専用ループ（後述）で処理するためスキップ
      if (prNumberSet.has(item.number)) continue;

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
        } else {
          logger.error(`Failed to close #${item.number}`);
        }
      } else if (item.issueState === "CLOSED") {
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

        const success = await updateIssueStatus(
          issueData.projectId,
          issueData.projectItemId,
          "Done",
          fields,
          logger,
        );

        fixes.push({
          number: item.number,
          action: "update-status",
          success,
          error: success ? undefined : "Failed to update project status",
        });

        if (success) {
          logger.success(`Updated #${item.number} status to Done`);
        } else {
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

      const success = await updateIssueStatus(
        prData.projectId,
        prData.projectItemId,
        targetStatus,
        fields,
        logger,
      );

      fixes.push({
        number: item.number,
        action: "update-pr-status",
        success,
        error: success ? undefined : "Failed to update PR project status",
      });

      if (success) {
        logger.success(`Updated PR #${item.number} status to ${targetStatus}`);
      } else {
        logger.error(`Failed to update PR #${item.number} status`);
      }
    }

    // 親ステータス不整合の修正: parentSummaries から期待ステータスを直接導出
    for (const summary of parentSummaries) {
      if (!summary.projectItemId || !summary.projectId) continue;
      const targetStatus = deriveExpectedParentStatus(summary.subIssueStatuses);
      if (!targetStatus || summary.currentStatus === targetStatus) continue;

      logger.info(`Updating parent #${summary.number} status to ${targetStatus}`);

      if (!projectFieldsCache[summary.projectId]) {
        projectFieldsCache[summary.projectId] = await getProjectFields(summary.projectId);
      }
      const fields = projectFieldsCache[summary.projectId];

      const success = await updateIssueStatus(
        summary.projectId,
        summary.projectItemId,
        targetStatus,
        fields,
        logger,
      );

      fixes.push({
        number: summary.number,
        action: "update-parent-status",
        success,
        error: success ? undefined : "Failed to update parent status",
      });

      if (success) {
        logger.success(`Updated parent #${summary.number} status to ${targetStatus}`);
      } else {
        logger.error(`Failed to update parent #${summary.number} status`);
      }
    }
  }

  // 通常 Issue / 計画 Issue が Approved (LEGACY) のままになっているケースを Done に統合（ADR-v3-022 第二改訂版 #2531）
  // 旧仕様 (ADR-v3-018) では Approved → Review に戻していたが、approve = Review → Done への意味変更に伴い Done 統合に変更
  // Completed LEGACY 値は --fix 対象外（手動対応が必要）
  if (options.fix && approvedInconsistencies.length > 0) {
    for (const item of approvedInconsistencies) {
      // LEGACY 値のうち Approved 誤設定のみ --fix 対象（Completed は手動対応）
      if (item.metadata?.legacyStatus !== LEGACY_STATUS_VALUES.APPROVED_LEGACY) {
        logger.debug(`#${item.number}: LEGACY "${item.metadata?.legacyStatus}" → 手動で Done に移行してください`);
        continue;
      }

      const issueData = allIssues.find((i) => i.number === item.number);
      if (!issueData?.projectItemId || !issueData?.projectId) {
        fixes.push({
          number: item.number,
          action: "approved-to-done",
          success: false,
          error: "Could not resolve project item ID",
        });
        continue;
      }

      if (!projectFieldsCache[issueData.projectId]) {
        projectFieldsCache[issueData.projectId] = await getProjectFields(issueData.projectId);
      }
      const fields = projectFieldsCache[issueData.projectId];

      const success = await updateIssueStatus(
        issueData.projectId,
        issueData.projectItemId,
        STATUS_VALUES.DONE,
        fields,
        logger,
      );

      fixes.push({
        number: item.number,
        action: "approved-to-done",
        success,
        error: success ? undefined : "Failed to update project status",
      });

      if (success) {
        logger.success(`Migrated #${item.number} status: Approved → Done`);
      } else {
        logger.error(`Failed to migrate #${item.number} status`);
      }
    }
  }

  if (options.fix && planParentInconsistencies.length > 0) {
    for (const item of planParentInconsistencies) {
      const pattern = item.metadata?.pattern;
      const parentNumber = item.metadata?.parentNumber
        ? parseInt(item.metadata.parentNumber, 10)
        : null;

      if (pattern === "P1") {
        logger.info(`P1 fix: 計画 Issue #${item.number} → In Progress`);
        const issueData = allIssues.find((i) => i.number === item.number);
        if (!issueData?.projectItemId || !issueData?.projectId) {
          fixes.push({ number: item.number, action: "plan-to-in-progress", success: false, error: "Could not resolve project item ID" });
          continue;
        }
        if (!projectFieldsCache[issueData.projectId]) {
          projectFieldsCache[issueData.projectId] = await getProjectFields(issueData.projectId);
        }
        const fields = projectFieldsCache[issueData.projectId];
        const success = await updateIssueStatus(issueData.projectId, issueData.projectItemId, STATUS_VALUES.IN_PROGRESS, fields, logger);
        fixes.push({ number: item.number, action: "plan-to-in-progress", success, error: success ? undefined : "Failed to update plan issue status" });
        if (success) {
          logger.success(`P1 fix: 計画 Issue #${item.number} → In Progress`);
        } else {
          logger.error(`P1 fix: 計画 Issue #${item.number} の In Progress 遷移に失敗`);
        }
      } else if (pattern === "P2a" && parentNumber !== null) {
        logger.info(`P2a fix: syncParentStatus で親 Issue #${parentNumber} を再導出`);
        try {
          await syncParentStatus(owner, repo, item.number, logger);
          fixes.push({ number: item.number, action: "sync-parent", success: true });
          logger.success(`P2a fix: 親 Issue #${parentNumber} を再導出しました`);
        } catch (err) {
          fixes.push({ number: item.number, action: "sync-parent", success: false, error: err instanceof Error ? err.message : String(err) });
          logger.error(`P2a fix: syncParentStatus に失敗しました`);
        }
      } else if (pattern === "P3") {
        logger.info(`P3 fix: 計画 Issue #${item.number} → Done + Close`);
        const issueData = allIssues.find((i) => i.number === item.number);
        if (!issueData?.projectItemId || !issueData?.projectId) {
          fixes.push({ number: item.number, action: "plan-to-done-close", success: false, error: "Could not resolve project item ID" });
          continue;
        }
        if (!projectFieldsCache[issueData.projectId]) {
          projectFieldsCache[issueData.projectId] = await getProjectFields(issueData.projectId);
        }
        const fields = projectFieldsCache[issueData.projectId];
        const statusSuccess = await updateIssueStatus(issueData.projectId, issueData.projectItemId, STATUS_VALUES.DONE, fields, logger);
        if (statusSuccess) {
          const issueId = await getIssueId(owner, repo, item.number);
          if (issueId) {
            const closeSuccess = await closeIssueById(issueId);
            fixes.push({ number: item.number, action: "plan-to-done-close", success: closeSuccess, error: closeSuccess ? undefined : "Close failed" });
            if (closeSuccess) {
              logger.success(`P3 fix: 計画 Issue #${item.number} → Done + Closed`);
            } else {
              logger.error(`P3 fix: 計画 Issue #${item.number} の Close に失敗`);
            }
          } else {
            fixes.push({ number: item.number, action: "plan-to-done-close", success: false, error: "Could not resolve issue ID for close" });
          }
        } else {
          fixes.push({ number: item.number, action: "plan-to-done-close", success: false, error: "Status update to Done failed" });
          logger.error(`P3 fix: 計画 Issue #${item.number} の Done 遷移に失敗`);
        }
      }
    }
  }

  // 5. メトリクスチェック
  const metricsConfig = getMetricsConfig(config);
  if (metricsConfig.enabled) {
    logger.debug("Metrics check enabled");

    const projectIds = new Set<string>();
    for (const issue of allIssues) {
      if (issue.projectId) projectIds.add(issue.projectId);
    }

    const allTextFieldValues: Record<string, Record<string, string>> = {};
    for (const pid of projectIds) {
      const values = await fetchItemTextFieldValues(pid);
      Object.assign(allTextFieldValues, values);
    }

    const metricsIssues = classifyMetricsInconsistencies(
      allIssues,
      allTextFieldValues,
      metricsConfig
    );
    logger.debug(`Metrics inconsistencies: ${metricsIssues.length}`);

    inconsistencies.push(...metricsIssues);
    // #2617: 欠落タイムスタンプの backfill 経路は削除（autoSetTimestamps 廃止に伴い、
    // missingField を含む inconsistency が発生しなくなったため）。
    // 残るのは stale 検出（info）のみで、これは fix 対象外（情報提供のみ）。
  }

  // 6. --fix 後に open-issues インデックスをリビルド
  if (options.fix && fixes.some((f) => f.success)) {
    rebuildOpenIssuesIndex(owner, repo);
    logger.info("open-issues インデックスを再構築しました");
  }

  // 7. Automation ステータスチェック
  let automationStatus: AutomationStatus | undefined;
  const projectId = await getProjectId(owner);
  if (projectId) {
    const detail = await fetchWorkflowsWithProject(projectId);
    if (detail && detail.workflows.length > 0) {
      const workflowSummary = detail.workflows.map((w: ProjectWorkflow) => ({
        name: w.name,
        enabled: w.enabled,
        recommended: RECOMMENDED_WORKFLOWS.includes(w.name),
      }));
      const missingRecommended = workflowSummary
        .filter((w) => w.recommended && !w.enabled)
        .map((w) => w.name);

      const workflowsSettingsUrl = detail.url ? `${detail.url}/workflows` : undefined;
      automationStatus = {
        checked: true,
        workflows: workflowSummary,
        missing_recommended: missingRecommended,
        workflows_settings_url: missingRecommended.length > 0 ? workflowsSettingsUrl : undefined,
      };

      if (missingRecommended.length > 0) {
        logger.warn(
          `Recommended automations disabled: ${missingRecommended.join(", ")}`
        );
        if (workflowsSettingsUrl) {
          logger.info(`Enable here: ${workflowsSettingsUrl}`);
        } else {
          logger.info("Enable via: GitHub Project Settings > Workflows");
        }
        logger.info("Note: GitHub does not provide an API to toggle workflows; manual UI step is required.");
      } else {
        logger.debug("All recommended automations are enabled");
      }
    }
  }

  // 8. 出力ビルド
  const output: IntegrityOutput = {
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

  if (output.summary.fix_failures > 0) return 1;
  if (!options.fix && output.summary.warnings > 0) return 1;
  return 0;
}
