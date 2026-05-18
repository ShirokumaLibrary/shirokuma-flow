/**
 * items sub-list サブコマンド (#1814)
 *
 * issues sub list から移行。親 Issue のサブ Issue を一覧表示する。
 * Sub-Issues API（GraphQL-Features: sub_issues ヘッダー）を使用する。
 */

import { Logger } from "../../../utils/logger.js";
import {
  runGraphQL,
  isIssueNumber,
  parseIssueNumber,
} from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { GRAPHQL_QUERY_SUB_ISSUES, SUB_ISSUES_GRAPHQL_HEADERS } from "../../items/helpers.js";
import type { SubListOptions } from "../../items/types.js";

// =============================================================================
// Command
// =============================================================================

/**
 * items sub-list サブコマンド - 親 Issue のサブ Issue を一覧表示する。
 */
export async function cmdSubList(
  parentNumberStr: string,
  options: SubListOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(parentNumberStr)) {
    logger.error(`Invalid issue number: ${parentNumberStr}`);
    return 1;
  }

  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;
  const parentNumber = parseIssueNumber(parentNumberStr);
  const projectName = repo;

  interface SubIssueNode {
    number?: number;
    title?: string;
    url?: string;
    state?: string;
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
            percentCompleted?: number;
          };
        };
      };
    };
  }

  const result = await runGraphQL<QueryResult>(
    GRAPHQL_QUERY_SUB_ISSUES,
    { owner, name: repo, number: parentNumber },
    { headers: SUB_ISSUES_GRAPHQL_HEADERS }
  );

  if (!result.success || !result.data?.data?.repository?.issue) {
    logger.error(`Issue #${parentNumber} not found`);
    return 1;
  }

  const issue = result.data.data.repository.issue;
  const subIssueNodes = issue.subIssues?.nodes ?? [];
  const summary = issue.subIssuesSummary;

  const subIssues = subIssueNodes
    .filter((n): n is SubIssueNode & { number: number } => !!n?.number)
    .map((n) => {
      const projectItems = n.projectItems?.nodes ?? [];
      const matchingItem = projectItems.find((p) => p?.project?.title === projectName);
      const labels = (n.labels?.nodes ?? []).map((l) => l?.name ?? "").filter(Boolean);

      return {
        number: n.number,
        title: n.title ?? "",
        url: n.url ?? "",
        state: n.state ?? "",
        labels,
        status: matchingItem?.status?.name ?? null,
        priority: matchingItem?.priority?.name ?? null,
        size: matchingItem?.size?.name ?? null,
      };
    });

  const output = {
    parent: {
      number: issue.number,
      title: issue.title ?? "",
    },
    sub_issues: subIssues,
    summary: {
      total: summary?.total ?? 0,
      completed: summary?.completed ?? 0,
      percent_completed: summary?.percentCompleted ?? 0,
    },
  };

  console.log(JSON.stringify(output, null, 2));
  return 0;
}
