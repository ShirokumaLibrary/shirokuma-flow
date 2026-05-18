/**
 * items list サブコマンド (#1814)
 *
 * issues list から移行。Projects フィールド付きで Issue 一覧を取得する。
 *
 * @related items/pull/index.ts - 個別 Issue 取得
 */

import {
  runGraphQL,
  GhResult,
  GhVariableValue,
} from "../../../utils/github.js";
import { loadGhConfig, getDefaultLimit } from "../../../utils/gh-config.js";
import {
  formatOutput,
  GH_ISSUES_LIST_COLUMNS,
} from "../../../utils/formatters.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import type { Logger } from "../../../utils/logger.js";
import type { ListOptions, IssueWithProjects } from "../../items/types.js";

// =============================================================================
// GraphQL Queries
// =============================================================================

const GRAPHQL_QUERY_ISSUES_WITH_PROJECTS = `
query($owner: String!, $name: String!, $first: Int!, $cursor: String, $states: [IssueState!]) {
  repository(owner: $owner, name: $name) {
    issues(first: $first, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}, states: $states) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        url
        state
        createdAt
        updatedAt
        issueType { name }
        labels(first: 10) {
          nodes { name }
        }
        projectItems(first: 5) {
          nodes {
            id
            project { title }
            status: fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue { name }
            }
            priority: fieldValueByName(name: "Priority") {
              ... on ProjectV2ItemFieldSingleSelectValue { name }
            }
            size: fieldValueByName(name: "Size") {
              ... on ProjectV2ItemFieldSingleSelectValue { name }
            }
          }
        }
      }
    }
  }
}
`;

// =============================================================================
// Command
// =============================================================================

/**
 * items list サブコマンド
 */
export async function cmdList(
  options: ListOptions,
  logger: Logger
): Promise<number> {
  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  // 設定のデフォルト値をロード
  const config = loadGhConfig();

  const { owner, name: repo } = repoInfo;
  const projectName = repo; // Project name = repo name convention

  // --all は --state all のショートカット
  const stateFilter = options.all ? "all" : (options.state ?? "open");

  interface IssueNode {
    number?: number;
    title?: string;
    url?: string;
    state?: string;
    createdAt?: string;
    updatedAt?: string;
    issueType?: { name?: string };
    labels?: { nodes?: Array<{ name?: string }> };
    projectItems?: {
      nodes?: Array<{
        id?: string;
        project?: { title?: string };
        status?: { name?: string };
        priority?: { name?: string };
        size?: { name?: string };
      }>;
    };
  }

  interface QueryResult {
    data?: {
      repository?: {
        issues?: {
          pageInfo?: { hasNextPage?: boolean; endCursor?: string };
          nodes?: IssueNode[];
        };
      };
    };
  }

  const allIssues: IssueWithProjects[] = [];
  let cursor: string | null = null;
  const limit = options.limit ?? getDefaultLimit(config);

  while (allIssues.length < limit) {
    const remaining = limit - allIssues.length;
    const fetchCount = Math.min(remaining, 50);

    const statesVar: GhVariableValue =
      stateFilter === "all" ? ["OPEN", "CLOSED"] :
      stateFilter === "closed" ? ["CLOSED"] :
      ["OPEN"];

    const result: GhResult<QueryResult> = await runGraphQL<QueryResult>(
      GRAPHQL_QUERY_ISSUES_WITH_PROJECTS,
      {
        owner,
        name: repo,
        first: fetchCount,
        cursor: cursor,
        states: statesVar,
      }
    );

    if (!result.success || !result.data?.data?.repository?.issues) break;

    const issuesData: NonNullable<NonNullable<NonNullable<QueryResult["data"]>["repository"]>["issues"]> =
      result.data.data.repository.issues;
    const nodes: IssueNode[] = issuesData.nodes ?? [];

    for (const node of nodes) {
      if (!node?.number) continue;

      const nodeState = node.state ?? "OPEN";
      if (stateFilter === "open" && nodeState !== "OPEN") continue;
      if (stateFilter === "closed" && nodeState !== "CLOSED") continue;

      type ProjectItemNode = NonNullable<NonNullable<IssueNode["projectItems"]>["nodes"]>[number];
      const projectItems: ProjectItemNode[] = node.projectItems?.nodes ?? [];
      const matchingItem = projectItems.find((p: ProjectItemNode) => p?.project?.title === projectName);

      type LabelNode = NonNullable<NonNullable<IssueNode["labels"]>["nodes"]>[number];
      const labelNodes: LabelNode[] = node.labels?.nodes ?? [];
      const issueLabels = labelNodes.map((l: LabelNode) => l?.name ?? "").filter(Boolean);

      if (options.labels && options.labels.length > 0) {
        const hasAllLabels = options.labels.every((label) => issueLabels.includes(label));
        if (!hasAllLabels) continue;
      }

      const issueTypeName = node.issueType?.name ?? "";
      if (options.issueType && issueTypeName !== options.issueType) continue;

      const issue: IssueWithProjects = {
        number: node.number,
        title: node.title ?? "",
        url: node.url ?? "",
        state: nodeState,
        issueType: issueTypeName || undefined,
        labels: issueLabels,
        createdAt: node.createdAt ?? "",
        updatedAt: node.updatedAt ?? "",
        projectItemId: matchingItem?.id,
        status: matchingItem?.status?.name,
        priority: matchingItem?.priority?.name,
        size: matchingItem?.size?.name,
      };

      allIssues.push(issue);
    }

    const pageInfo = issuesData.pageInfo ?? {};
    if (!pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor ?? null;
  }

  let filteredIssues = allIssues;
  if (options.status && options.status.length > 0) {
    filteredIssues = allIssues.filter((i) => options.status!.includes(i.status ?? ""));
  }

  const output = {
    repository: `${owner}/${repo}`,
    issues: filteredIssues.map((i) => ({
      number: i.number,
      title: i.title,
      url: i.url,
      state: i.state,
      issue_type: i.issueType,
      labels: i.labels,
      status: i.status,
      priority: i.priority,
      size: i.size,
      project_item_id: i.projectItemId,
    })),
    total_count: filteredIssues.length,
  };

  const outputFormat = options.format ?? "table-json";
  const formatted = formatOutput(output, outputFormat, {
    arrayKey: "issues",
    columns: GH_ISSUES_LIST_COLUMNS,
  });
  console.log(formatted);
  return 0;
}
