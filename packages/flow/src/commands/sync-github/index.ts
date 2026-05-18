/**
 * sync-github - GitHub Issues/Discussions データ取得・JSON 生成 (#2495)
 *
 * `generate github-data` のトップレベル昇格版。
 * GitHub Issues, Discussions, リポジトリ情報を取得して JSON として保存する。
 */

import { resolve } from "node:path";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createLogger } from "../../utils/logger.js";
import { t } from "../../utils/i18n.js";
import { getRepoInfo, runGraphQL } from "../../utils/github.js";
import { loadGhConfig } from "../../utils/gh-config.js";
import { STATUS_VALUES, LEGACY_STATUS_VALUES, isBlockedEquivalent } from "../../utils/status-workflow.js";

export interface GithubDataOptions {
  project: string;
  output?: string;
  verbose?: boolean;
}

interface GithubIssue {
  number: number;
  title: string;
  url: string;
  state: string;
  labels: string[];
  status: string | null;
  priority: string | null;
  size: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GithubDiscussion {
  number: number;
  title: string;
  url: string;
  category: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  body?: string;
}

interface GithubRepoInfo {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  defaultBranch: string;
  visibility: string;
  stargazers: number;
  forks: number;
  issues: number;
  pullRequests: number;
}

export interface GithubData {
  repository: GithubRepoInfo;
  issues: {
    inProgress: GithubIssue[];
    backlog: GithubIssue[];
    done: GithubIssue[];
    total: number;
  };
  specs: GithubDiscussion[];
  fetchedAt: string;
}

const GRAPHQL_QUERY_REPO_INFO = `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    owner { login }
    name
    nameWithOwner
    description
    url
    defaultBranchRef { name }
    visibility
    stargazerCount
    forkCount
    issues(states: OPEN) { totalCount }
    pullRequests(states: OPEN) { totalCount }
  }
}
`;

interface RepoInfoQueryResult {
  data?: {
    repository?: {
      owner?: { login?: string };
      name?: string;
      nameWithOwner?: string;
      description?: string | null;
      url?: string;
      defaultBranchRef?: { name?: string };
      visibility?: string;
      stargazerCount?: number;
      forkCount?: number;
      issues?: { totalCount?: number };
      pullRequests?: { totalCount?: number };
    };
  };
}

/**
 * Fetch repository info via GraphQL
 */
async function fetchRepoInfo(): Promise<GithubRepoInfo> {
  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    throw new Error("Failed to get repository info");
  }
  const { owner, name } = repoInfo;

  const result = await runGraphQL<RepoInfoQueryResult>(
    GRAPHQL_QUERY_REPO_INFO,
    { owner, name }
  );

  if (!result.success) {
    throw new Error(`Failed to fetch repo info: ${result.error}`);
  }

  if (!result.data?.data?.repository) {
    throw new Error("Failed to fetch repo info: no repository data");
  }

  const r = result.data.data.repository;

  return {
    owner: r.owner?.login || "",
    name: r.name || "",
    fullName: r.nameWithOwner || "",
    description: r.description ?? null,
    url: r.url || "",
    defaultBranch: r.defaultBranchRef?.name || "main",
    visibility: r.visibility || "private",
    stargazers: r.stargazerCount || 0,
    forks: r.forkCount || 0,
    issues: r.issues?.totalCount || 0,
    pullRequests: r.pullRequests?.totalCount || 0,
  };
}

interface FieldValue {
  name?: string;
  field?: { name?: string };
}

interface GraphQLIssueNode {
  number: number;
  title: string;
  url: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  labels?: {
    nodes?: Array<{ name: string }>;
  };
  projectItems?: {
    nodes?: Array<{
      project?: { title?: string };
      fieldValues?: {
        nodes?: FieldValue[];
      };
    }>;
  };
}

interface IssuesConnection {
  pageInfo?: {
    hasNextPage?: boolean;
    endCursor?: string;
  };
  nodes?: GraphQLIssueNode[];
}

interface GraphQLIssuesData {
  data?: {
    repository?: {
      issues?: IssuesConnection;
    };
  };
}

/**
 * Fetch a single page of issues
 */
async function fetchIssuesPage(
  owner: string,
  name: string,
  cursor: string | null
): Promise<{ connection: IssuesConnection | undefined; error?: string }> {
  const query = `
    query($owner: String!, $repo: String!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        issues(first: 100, after: $cursor, states: [OPEN]) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            number
            title
            url
            state
            createdAt
            updatedAt
            labels(first: 10) {
              nodes { name }
            }
            projectItems(first: 1) {
              nodes {
                project { title }
                fieldValues(first: 10) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2SingleSelectField { name } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await runGraphQL<GraphQLIssuesData>(query, {
    owner,
    repo: name,
    cursor,
  });

  if (!result.success) {
    return { connection: undefined, error: result.error };
  }

  return { connection: result.data?.data?.repository?.issues };
}

/**
 * Parse a GraphQL issue node into a GithubIssue
 */
function parseIssueNode(issue: GraphQLIssueNode): GithubIssue {
  const projectItem = issue.projectItems?.nodes?.[0];
  const fieldValues = projectItem?.fieldValues?.nodes || [];

  const getFieldValue = (fieldName: string): string | null => {
    const field = fieldValues.find((f) => f.field?.name === fieldName);
    return field?.name || null;
  };

  return {
    number: issue.number,
    title: issue.title,
    url: issue.url,
    state: issue.state,
    labels: issue.labels?.nodes?.map((l) => l.name) || [],
    status: getFieldValue("Status"),
    priority: getFieldValue("Priority"),
    size: getFieldValue("Size"),
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

/**
 * Fetch issues with project fields using GraphQL
 */
async function fetchIssuesWithProjects(): Promise<GithubIssue[]> {
  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    throw new Error("Failed to get repository info");
  }
  const { owner, name } = repoInfo;

  const issues: GithubIssue[] = [];
  let cursor: string | null = null;

  for (;;) {
    const { connection, error } = await fetchIssuesPage(owner, name, cursor);

    if (error) {
      throw new Error(`GraphQL query failed: ${error}`);
    }

    if (!connection?.nodes) {
      break;
    }

    for (const node of connection.nodes) {
      issues.push(parseIssueNode(node));
    }

    if (connection.pageInfo?.hasNextPage && connection.pageInfo.endCursor) {
      cursor = connection.pageInfo.endCursor;
    } else {
      break;
    }
  }

  return issues;
}

interface GraphQLDiscussionNode {
  number: number;
  title: string;
  url: string;
  body?: string;
  createdAt: string;
  updatedAt: string;
  author?: { login?: string };
  category?: { name?: string };
}

interface DiscussionsConnection {
  pageInfo?: {
    hasNextPage?: boolean;
    endCursor?: string;
  };
  nodes?: GraphQLDiscussionNode[];
}

interface GraphQLDiscussionsData {
  data?: {
    repository?: {
      discussions?: DiscussionsConnection;
    };
  };
}

/**
 * Fetch a single page of discussions
 */
async function fetchDiscussionsPage(
  owner: string,
  name: string,
  cursor: string | null
): Promise<{ connection: DiscussionsConnection | undefined; error?: string }> {
  const query = `
    query($owner: String!, $repo: String!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        discussions(first: 50, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            number
            title
            url
            body
            createdAt
            updatedAt
            author { login }
            category { name }
          }
        }
      }
    }
  `;

  const result = await runGraphQL<GraphQLDiscussionsData>(query, {
    owner,
    repo: name,
    cursor,
  });

  if (!result.success) {
    return { connection: undefined, error: result.error };
  }

  return { connection: result.data?.data?.repository?.discussions };
}

/**
 * Fetch discussions by category
 */
async function fetchDiscussions(categoryName: string): Promise<GithubDiscussion[]> {
  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    throw new Error("Failed to get repository info");
  }
  const { owner, name } = repoInfo;

  const discussions: GithubDiscussion[] = [];
  let cursor: string | null = null;

  for (;;) {
    const { connection, error } = await fetchDiscussionsPage(owner, name, cursor);

    if (error) {
      throw new Error(`GraphQL query failed: ${error}`);
    }

    if (!connection?.nodes) {
      break;
    }

    for (const disc of connection.nodes) {
      if (disc.category?.name === categoryName) {
        discussions.push({
          number: disc.number,
          title: disc.title,
          url: disc.url,
          category: disc.category.name,
          author: disc.author?.login || "unknown",
          createdAt: disc.createdAt,
          updatedAt: disc.updatedAt,
          body: disc.body,
        });
      }
    }

    if (connection.pageInfo?.hasNextPage && connection.pageInfo.endCursor) {
      cursor = connection.pageInfo.endCursor;
    } else {
      break;
    }
  }

  return discussions;
}

/** Group issues by status. Pending / Ready は Backlog 扱い、On Hold は Blocked 扱い（旧表記吸収） */
function groupIssuesByStatus(issues: GithubIssue[]) {
  const groups = {
    inProgress: [] as GithubIssue[],
    backlog: [] as GithubIssue[],
    done: [] as GithubIssue[],
    total: issues.length,
  };

  for (const issue of issues) {
    if (
      issue.status === STATUS_VALUES.IN_PROGRESS ||
      isBlockedEquivalent(issue.status) ||
      issue.status === STATUS_VALUES.REVIEW ||
      issue.status === LEGACY_STATUS_VALUES.COMPLETED_LEGACY // #2440: "Completed" LEGACY → Done（既存 Issue の保険）
    ) {
      groups.inProgress.push(issue);
    } else if (issue.status === STATUS_VALUES.DONE) {
      groups.done.push(issue);
    } else {
      groups.backlog.push(issue);
    }
  }

  const priorityOrder: Record<string, number> = {
    Critical: 0,
    High: 1,
    Medium: 2,
    Low: 3,
  };

  const sortByPriority = (a: GithubIssue, b: GithubIssue) => {
    const aPriority = priorityOrder[a.priority || "Low"] ?? 4;
    const bPriority = priorityOrder[b.priority || "Low"] ?? 4;
    return aPriority - bPriority;
  };

  groups.inProgress.sort(sortByPriority);
  groups.backlog.sort(sortByPriority);

  return groups;
}

/**
 * GitHub データ取得・JSON 生成
 */
export async function githubDataCommand(
  options: GithubDataOptions
): Promise<GithubData> {
  const logger = createLogger(options.verbose);
  const projectPath = resolve(options.project);

  logger.info(t("commands.githubData.fetching"));

  // Load config (referenced for Specs category resolution if extended later)
  void loadGhConfig(projectPath);
  const specsCategory = "Specs";

  // Fetch all data
  let repoInfo: GithubRepoInfo | null = null;
  let issues: GithubIssue[] = [];
  let specs: GithubDiscussion[] = [];

  try {
    repoInfo = await fetchRepoInfo();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn(`Repository info fetch failed: ${message}`);
  }

  try {
    issues = await fetchIssuesWithProjects();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn(`Issues fetch failed: ${message}`);
  }

  try {
    specs = await fetchDiscussions(specsCategory);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn(`Specs fetch failed: ${message}`);
  }

  const githubData: GithubData = {
    repository: repoInfo || {
      owner: "",
      name: "",
      fullName: "",
      description: null,
      url: "",
      defaultBranch: "main",
      visibility: "private",
      stargazers: 0,
      forks: 0,
      issues: 0,
      pullRequests: 0,
    },
    issues: groupIssuesByStatus(issues),
    specs,
    fetchedAt: new Date().toISOString(),
  };

  // Write to output file if specified
  if (options.output) {
    const outputDir = resolve(options.output);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = resolve(outputDir, "github-data.json");
    writeFileSync(outputPath, JSON.stringify(githubData, null, 2));
    logger.success(`GitHub データを保存: ${outputPath}`);
  }

  // Summary
  logger.info("=== GitHub Data Summary ===");
  logger.info(`Repository: ${githubData.repository.fullName}`);
  logger.info(`Issues: ${githubData.issues.total} total`);
  logger.info(`  - In Progress: ${githubData.issues.inProgress.length}`);
  logger.info(`  - Backlog: ${githubData.issues.backlog.length}`);
  logger.info(`  - Done: ${githubData.issues.done.length}`);
  logger.info(`Specs: ${githubData.specs.length}`);

  return githubData;
}
