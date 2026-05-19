/**
 * items pull - Issue 取得・キャッシュ書き込み (#1808)
 *
 * @related push/issue.ts - Issue 本体の push ロジック
 * @related add/issue.ts - Issue 作成ロジック
 */
import { runGraphQL } from "../../../utils/github.js";
import { writeCache, writeCommentCache } from "../../../utils/github-cache.js";
import { getProjectId } from "../../../utils/project-utils.js";
// =============================================================================
// GraphQL クエリ定義
// =============================================================================
/**
 * Issue 詳細取得（Projects フィールド付き）
 * GRAPHQL_QUERY_ISSUE_DETAIL をベースに items 用に拡張
 */
export const GRAPHQL_QUERY_ISSUE_WITH_FIELDS = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      number
      title
      body
      url
      state
      updatedAt
      labels(first: 20) {
        nodes { name }
      }
      assignees(first: 10) {
        nodes { login }
      }
      projectItems(first: 5) {
        nodes {
          id
          project { id title }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
          }
          priority: fieldValueByName(name: "Priority") {
            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
          }
          size: fieldValueByName(name: "Size") {
            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
          }
        }
      }
      parent {
        number
        title
      }
      subIssuesSummary {
        total
        completed
        percentCompleted
      }
    }
  }
}
`;
/** Issue コメント取得（first: 100） */
export const GRAPHQL_QUERY_ISSUE_COMMENTS = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      comments(first: 100) {
        totalCount
        nodes {
          id
          databaseId
          author { login }
          body
          createdAt
          updatedAt
          url
        }
      }
    }
  }
}
`;
// =============================================================================
// ヘルパー
// =============================================================================
/**
 * Issue ノードから Projects フィールド（status/priority/size）とラベル・担当者を解決する。
 * fetchAndCacheIssue と fetchRemoteIssueSnapshot の共通ロジック。
 */
export async function resolveIssueProjectFields(node, owner, repo) {
    const projectItems = node.projectItems?.nodes ?? [];
    let projectId;
    try {
        projectId = await getProjectId(owner, repo) ?? undefined;
    }
    catch {
        // プロジェクト未設定の場合は無視
    }
    const matchingItem = projectItems.find((p) => projectId ? p?.project?.id === projectId : p?.project?.title === repo) ?? projectItems[0];
    const labels = (node.labels?.nodes ?? []).map((l) => l?.name ?? "").filter(Boolean);
    const assignees = (node.assignees?.nodes ?? []).map((a) => a?.login ?? "").filter(Boolean);
    return {
        status: matchingItem?.status?.name,
        priority: matchingItem?.priority?.name,
        size: matchingItem?.size?.name,
        labels,
        assignees,
    };
}
// =============================================================================
// Issue 取得・キャッシュ書き込み
// =============================================================================
/**
 * Issue 本体 + コメントを取得してキャッシュに書き込む。
 * `RemoteItemSnapshot` を返す（check コマンドとの共有用）。
 */
export async function fetchAndCacheIssue(owner, repo, number, org, baseDir, logger) {
    const graphqlVars = { owner, name: repo, number };
    // 本体とコメントを並列取得（sub_issues GraphQL 機能フラグを付与）
    const [issueResult, commentsResult] = await Promise.all([
        runGraphQL(GRAPHQL_QUERY_ISSUE_WITH_FIELDS, graphqlVars, { headers: { "GraphQL-Features": "sub_issues" } }),
        runGraphQL(GRAPHQL_QUERY_ISSUE_COMMENTS, graphqlVars),
    ]);
    if (!issueResult.success || !issueResult.data?.data?.repository?.issue) {
        return null;
    }
    const node = issueResult.data.data.repository.issue;
    // Projects フィールドを解決
    const { status, priority, size, labels, assignees } = await resolveIssueProjectFields(node, owner, repo);
    // 共通フィールド（キャッシュと戻り値で共有）
    const resolvedLabels = labels.length > 0 ? labels : undefined;
    const resolvedAssignees = assignees.length > 0 ? assignees : undefined;
    const resolvedParent = node.parent?.number;
    const resolvedSubIssuesSummary = node.subIssuesSummary
        ? {
            total: node.subIssuesSummary.total ?? 0,
            completed: node.subIssuesSummary.completed ?? 0,
            percentCompleted: node.subIssuesSummary.percentCompleted ?? 0,
        }
        : undefined;
    // キャッシュ書き込み
    const cacheMetadata = {
        number,
        type: "issue",
        updated_at: node.updatedAt,
        title: node.title,
        status,
        priority,
        size,
        labels: resolvedLabels,
        assignees: resolvedAssignees,
        parent: resolvedParent,
        subIssuesSummary: resolvedSubIssuesSummary,
    };
    writeCache(number, cacheMetadata, node.body ?? "", org, repo, baseDir);
    // コメントをキャッシュ書き込み
    if (commentsResult.success && commentsResult.data?.data?.repository?.issue?.comments) {
        const commentsData = commentsResult.data.data.repository.issue.comments;
        const nodes = commentsData.nodes ?? [];
        const totalCount = commentsData.totalCount ?? 0;
        if (nodes.length < totalCount) {
            logger?.warn(`Issue #${number}: comments ${nodes.length}/${totalCount} 件取得（上限超過）`);
        }
        for (const c of nodes) {
            if (c.databaseId) {
                writeCommentCache(number, c.databaseId, {
                    number,
                    database_id: c.databaseId,
                    updated_at: c.updatedAt,
                }, c.body ?? "", "issue", org, repo, baseDir);
            }
        }
        logger?.info(`Issue #${number}: ${nodes.length} コメントをキャッシュしました`);
    }
    return {
        number,
        type: "issue",
        title: node.title ?? "",
        body: node.body ?? "",
        updated_at: node.updatedAt ?? "",
        status,
        priority,
        size,
        labels: resolvedLabels,
        assignees: resolvedAssignees,
        parent: resolvedParent,
        subIssuesSummary: resolvedSubIssuesSummary,
    };
}
//# sourceMappingURL=issue.js.map