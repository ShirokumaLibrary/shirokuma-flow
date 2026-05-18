/**
 * repo info subcommand - Get repository information
 */

import type { Logger } from "../../utils/logger.js";
import {
  runGraphQL,
  getRepoInfo,
} from "../../utils/github.js";

// =============================================================================
// Types
// =============================================================================

export interface RepoInfoOptions {
  verbose?: boolean;
}

interface RepoNode {
  owner?: { login?: string };
  name?: string;
  nameWithOwner?: string;
  description?: string;
  url?: string;
  defaultBranchRef?: { name?: string };
  visibility?: string;
  isPrivate?: boolean;
  isFork?: boolean;
  stargazerCount?: number;
  forkCount?: number;
  issues?: { totalCount?: number };
  hasIssuesEnabled?: boolean;
  hasProjectsEnabled?: boolean;
  hasDiscussionsEnabled?: boolean;
  hasWikiEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  pushedAt?: string;
}

interface QueryResult {
  data?: {
    repository?: RepoNode;
  };
}

// =============================================================================
// GraphQL Query
// =============================================================================

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
    isPrivate
    isFork
    stargazerCount
    forkCount
    issues(states: OPEN) { totalCount }
    hasIssuesEnabled
    hasProjectsEnabled
    hasDiscussionsEnabled
    hasWikiEnabled
    createdAt
    updatedAt
    pushedAt
  }
}
`;

// =============================================================================
// Handler
// =============================================================================

export async function cmdInfo(
  options: RepoInfoOptions,
  logger: Logger
): Promise<number> {
  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;

  const result = await runGraphQL<QueryResult>(GRAPHQL_QUERY_REPO_INFO, {
    owner,
    name: repo,
  });

  if (!result.success || !result.data?.data?.repository) {
    logger.error("Failed to get repository information");
    return 1;
  }

  const r = result.data.data.repository;

  const output = {
    owner: r.owner?.login ?? owner,
    name: r.name ?? repo,
    full_name: r.nameWithOwner ?? `${owner}/${repo}`,
    description: r.description ?? "",
    url: r.url ?? "",
    default_branch: r.defaultBranchRef?.name ?? "main",
    visibility: r.visibility ?? "PRIVATE",
    is_private: r.isPrivate ?? true,
    is_fork: r.isFork ?? false,
    stargazers_count: r.stargazerCount ?? 0,
    forks_count: r.forkCount ?? 0,
    open_issues_count: r.issues?.totalCount ?? 0,
    features: {
      has_issues: r.hasIssuesEnabled ?? true,
      has_projects: r.hasProjectsEnabled ?? true,
      has_discussions: r.hasDiscussionsEnabled ?? false,
      has_wiki: r.hasWikiEnabled ?? false,
    },
    created_at: r.createdAt ?? "",
    updated_at: r.updatedAt ?? "",
    pushed_at: r.pushedAt ?? "",
  };

  console.log(JSON.stringify(output, null, 2));
  return 0;
}
