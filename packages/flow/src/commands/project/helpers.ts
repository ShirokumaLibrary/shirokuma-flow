/**
 * project command - Shared helpers, types, and GraphQL queries
 *
 * Used by all project subcommand handlers.
 */

import {
  runGraphQL,
  getOwner,
  getRepoName,
  isIssueNumber,
  parseIssueNumber,
  GhResult,
} from "../../utils/github.js";
import {
  getProjectId,
  fetchWorkflows,
  RECOMMENDED_WORKFLOWS,
  type ProjectWorkflow,
} from "../../utils/project-utils.js";

// Re-export from project-utils (extracted for cross-file sharing)
export {
  getProjectId,
  fetchWorkflows,
  RECOMMENDED_WORKFLOWS,
  type ProjectWorkflow,
};

// Re-export commonly used utils for subcommand handlers
export {
  runGraphQL,
  getOwner,
  getRepoName,
  isIssueNumber,
  parseIssueNumber,
};
export type { GhResult };

// Re-export from shared location for subcommand handlers
export { DEFAULT_EXCLUDE_STATUSES } from "../../utils/status-workflow.js";

// =============================================================================
// Types
// =============================================================================

export interface ProjectsOptions {
  owner?: string;
  verbose?: boolean;
  all?: boolean;
  status?: string[];
  force?: boolean;
  // Output format
  format?: OutputFormat;
  // Field options for create/update
  fieldStatus?: string;
  priority?: string;
  size?: string;
  title?: string;
  bodyFile?: string;
}

export interface ProjectInfo {
  id: string;
  title: string;
  owner: string;
}

export interface ProjectItem {
  id: string;
  title: string | null;
  body?: string | null;
  status: string | null;
  statusOptionId?: string | null;
  priority: string | null;
  priorityOptionId?: string | null;
  size: string | null;
  sizeOptionId?: string | null;
  issueNumber: number | null;
  issueUrl?: string | null;
  draftIssueId?: string | null;
  project?: { id: string; title: string };
}

import { OutputFormat } from "../../utils/formatters.js";

// =============================================================================
// GraphQL Queries
// =============================================================================

export const GRAPHQL_QUERY_LIST = `
query($projectId: ID!, $cursor: String) {
  node(id: $projectId) {
    ... on ProjectV2 {
      title
      items(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
          priority: fieldValueByName(name: "Priority") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
          size: fieldValueByName(name: "Size") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
          content {
            ... on DraftIssue { title }
            ... on Issue { title number }
          }
        }
      }
    }
  }
}
`;

export const GRAPHQL_QUERY_ITEM = `
query($itemId: ID!) {
  node(id: $itemId) {
    ... on ProjectV2Item {
      id
      status: fieldValueByName(name: "Status") {
        ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
      }
      priority: fieldValueByName(name: "Priority") {
        ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
      }
      size: fieldValueByName(name: "Size") {
        ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
      }
      content {
        ... on DraftIssue { id title body }
        ... on Issue { id title number body url }
      }
      project { id title }
    }
  }
}
`;

export const GRAPHQL_MUTATION_CREATE = `
mutation($projectId: ID!, $title: String!, $body: String) {
  addProjectV2DraftIssue(input: {projectId: $projectId, title: $title, body: $body}) {
    projectItem { id }
  }
}
`;

export const GRAPHQL_MUTATION_UPDATE_BODY = `
mutation($draftIssueId: ID!, $body: String!) {
  updateProjectV2DraftIssue(input: {draftIssueId: $draftIssueId, body: $body}) {
    draftIssue { id body }
  }
}
`;

export const GRAPHQL_MUTATION_UPDATE_ISSUE = `
mutation($id: ID!, $body: String!) {
  updateIssue(input: {id: $id, body: $body}) {
    issue { id number title body }
  }
}
`;

export const GRAPHQL_QUERY_ISSUE_BY_NUMBER = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id
      number
      title
      body
      url
    }
  }
}
`;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Fetch all project items with pagination
 */
export async function fetchAllItems(
  projectId: string
): Promise<{ title: string; items: ProjectItem[] }> {
  interface ItemNode {
    id?: string;
    status?: { name?: string };
    priority?: { name?: string };
    size?: { name?: string };
    content?: { title?: string; number?: number };
  }

  interface QueryResult {
    data?: {
      node?: {
        title?: string;
        items?: {
          pageInfo?: { hasNextPage?: boolean; endCursor?: string };
          nodes?: ItemNode[];
        };
      };
    };
  }

  const allItems: ProjectItem[] = [];
  let cursor: string | null = null;
  let projectTitle = "";

  while (true) {
    const result: GhResult<QueryResult> = await runGraphQL<QueryResult>(GRAPHQL_QUERY_LIST, {
      projectId,
      cursor: cursor ?? null,
    });

    if (!result.success || !result.data?.data?.node) break;

    const node: NonNullable<NonNullable<QueryResult["data"]>["node"]> = result.data.data.node;
    projectTitle = node.title ?? "";

    const itemsData = node.items ?? { nodes: [], pageInfo: {} };
    const nodes: ItemNode[] = itemsData.nodes ?? [];

    for (const item of nodes) {
      if (!item?.id) continue;
      allItems.push({
        id: item.id,
        title: item.content?.title ?? null,
        status: item.status?.name ?? null,
        priority: item.priority?.name ?? null,
        size: item.size?.name ?? null,
        issueNumber: item.content?.number ?? null,
      });
    }

    const pageInfo = itemsData.pageInfo ?? {};
    if (!pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor ?? null;
  }

  return { title: projectTitle, items: allItems };
}

/**
 * Fetch a single project item by ID with full details
 */
export async function fetchItem(itemId: string): Promise<ProjectItem | null> {
  interface ItemNode {
    id?: string;
    status?: { name?: string; optionId?: string };
    priority?: { name?: string; optionId?: string };
    size?: { name?: string; optionId?: string };
    content?: {
      id?: string;
      title?: string;
      body?: string;
      number?: number;
      url?: string;
    };
    project?: { id?: string; title?: string };
  }

  interface QueryResult {
    data?: {
      node?: ItemNode;
    };
  }

  const result = await runGraphQL<QueryResult>(GRAPHQL_QUERY_ITEM, { itemId });
  if (!result.success || !result.data?.data?.node) return null;

  const node = result.data.data.node;
  const content = node.content ?? {};
  const project = node.project ?? {};

  return {
    id: node.id ?? itemId,
    title: content.title ?? null,
    body: content.body ?? null,
    status: node.status?.name ?? null,
    statusOptionId: node.status?.optionId ?? null,
    priority: node.priority?.name ?? null,
    priorityOptionId: node.priority?.optionId ?? null,
    size: node.size?.name ?? null,
    sizeOptionId: node.size?.optionId ?? null,
    issueNumber: content.number ?? null,
    issueUrl: content.url ?? null,
    draftIssueId: content.number ? null : content.id ?? null,
    project: project.id ? { id: project.id, title: project.title ?? "" } : undefined,
  };
}

/**
 * Find project item by issue number
 */
export async function findItemByIssueNumber(
  projectId: string,
  issueNumber: number
): Promise<{ id: string } | null> {
  const { items } = await fetchAllItems(projectId);
  for (const item of items) {
    if (item.issueNumber === issueNumber) {
      return { id: item.id };
    }
  }
  return null;
}

/**
 * Get issue by number
 */
export async function getIssueByNumber(
  owner: string,
  repo: string,
  number: number
): Promise<{ id: string; number: number; title: string; body: string; url: string } | null> {
  interface QueryResult {
    data?: {
      repository?: {
        issue?: {
          id?: string;
          number?: number;
          title?: string;
          body?: string;
          url?: string;
        };
      };
    };
  }

  const result = await runGraphQL<QueryResult>(GRAPHQL_QUERY_ISSUE_BY_NUMBER, {
    owner,
    name: repo,
    number,
  });

  if (!result.success) return null;
  const issue = result.data?.data?.repository?.issue;
  if (!issue?.id) return null;

  return {
    id: issue.id,
    number: issue.number ?? number,
    title: issue.title ?? "",
    body: issue.body ?? "",
    url: issue.url ?? "",
  };
}

/**
 * Build project field dict from options for setItemFields.
 * Extracts Status/Priority/Size from ProjectsOptions.
 */
export function buildFieldsDict(options: Pick<ProjectsOptions, "fieldStatus" | "priority" | "size">): Record<string, string> {
  const fields: Record<string, string> = {};
  if (options.fieldStatus) fields["Status"] = options.fieldStatus;
  if (options.priority) fields["Priority"] = options.priority;
  if (options.size) fields["Size"] = options.size;
  return fields;
}
