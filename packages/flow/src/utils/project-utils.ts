/**
 * プロジェクト関連ユーティリティ（共有関数）。
 *
 * projects.ts から抽出。複数の commands/utils ファイルから参照される
 * 共有関数を集約し、Phase 2 の並行作業でコンフリクトを防ぐ。
 */

import { runGraphQL, getRepoName } from "./github.js";
import { getOctokit } from "./octokit-client.js";
import { createLogger } from "./logger.js";

// =============================================================================
// Types
// =============================================================================

/** ワークフロー情報 */
export interface ProjectWorkflow {
  id: string;
  name: string;
  number: number;
  enabled: boolean;
}

/** #250 推奨ワークフロー: 有効にすべき自動化 */
export const RECOMMENDED_WORKFLOWS = ["Item closed", "Pull request merged", "Pull request linked to issue"];

// =============================================================================
// GraphQL Queries
// =============================================================================

/** プロジェクトのワークフロー一覧を取得（プロジェクト本体の number/url も同時取得） */
const GRAPHQL_QUERY_WORKFLOWS = `
query($projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      title
      number
      url
      workflows(first: 20) {
        nodes {
          id
          name
          number
          enabled
        }
      }
    }
  }
}
`;

// =============================================================================
// Functions
// =============================================================================

// =============================================================================
// GraphQL Queries - Project list
// =============================================================================

/** Organization の ProjectsV2 一覧を取得 */
const GRAPHQL_QUERY_ORG_PROJECTS = `
query($login: String!, $first: Int!) {
  organization(login: $login) {
    projectsV2(first: $first) {
      nodes {
        id
        title
      }
    }
  }
}
`;

/** User の ProjectsV2 一覧を取得 */
const GRAPHQL_QUERY_USER_PROJECTS = `
query($login: String!, $first: Int!) {
  user(login: $login) {
    projectsV2(first: $first) {
      nodes {
        id
        title
      }
    }
  }
}
`;

/**
 * プロジェクト名から GitHub Projects V2 の ID を取得する（デフォルトはリポジトリ名）。
 * Organization を先に試行し、失敗時に User にフォールバックする。
 * 名前一致するプロジェクトがない場合は最初のプロジェクトをフォールバックとして使用する。
 *
 * @param owner - GitHub Organization または User のログイン名
 * @param projectName - 検索するプロジェクト名。省略時はカレントリポジトリ名を使用
 * @returns プロジェクトの GraphQL Node ID。取得失敗時は `null`
 *
 * @example
 * ```typescript
 * const projectId = await getProjectId("my-org")
 * const namedId = await getProjectId("my-org", "my-project")
 * ```
 *
 * @category Project
 */
export async function getProjectId(owner: string, projectName?: string): Promise<string | null> {
  const targetName = projectName || getRepoName();
  if (!targetName) return null;

  interface ProjectNode {
    id?: string;
    title?: string;
  }

  interface OrgQueryResult {
    data?: {
      organization?: {
        projectsV2?: {
          nodes?: ProjectNode[];
        };
      };
    };
  }

  interface UserQueryResult {
    data?: {
      user?: {
        projectsV2?: {
          nodes?: ProjectNode[];
        };
      };
    };
  }

  // Organization を先に試行
  let projects: ProjectNode[] = [];
  const orgResult = await runGraphQL<OrgQueryResult>(GRAPHQL_QUERY_ORG_PROJECTS, {
    login: owner,
    first: 50,
  });

  if (orgResult.success) {
    projects = orgResult.data?.data?.organization?.projectsV2?.nodes ?? [];
  } else {
    // User にフォールバック
    const userResult = await runGraphQL<UserQueryResult>(GRAPHQL_QUERY_USER_PROJECTS, {
      login: owner,
      first: 50,
    });

    if (!userResult.success) return null;
    projects = userResult.data?.data?.user?.projectsV2?.nodes ?? [];
  }

  if (projects.length === 0) return null;

  // Find project by name (repository name convention)
  for (const project of projects) {
    if (project?.title === targetName) {
      return project.id ?? null;
    }
  }

  // Fallback to first project if no match (#382: warn about fallback)
  const fallbackId = projects[0]?.id ?? null;
  if (fallbackId) {
    const logger = createLogger();
    logger.warn(`No project named '${targetName}'. Using first project as fallback.`);
  }
  return fallbackId;
}

/**
 * Owner の GraphQL Node ID を取得する。
 * Organization を先に試行し、失敗時に User にフォールバック。
 * `createProjectV2` mutation に必要。
 *
 * @param owner - GitHub Organization または User のログイン名
 * @returns GraphQL Node ID 文字列。Organization / User いずれも取得失敗時は `null`
 *
 * @example
 * ```typescript
 * const nodeId = await getOwnerNodeId("my-org")
 * ```
 *
 * @category Project
 */
export async function getOwnerNodeId(owner: string): Promise<string | null> {
  const octokit = getOctokit();

  // Organization を試行
  try {
    const { data } = await octokit.rest.orgs.get({ org: owner });
    return data.node_id ?? null;
  } catch {
    // Organization でなければ User を試行
  }

  try {
    const { data } = await octokit.rest.users.getByUsername({ username: owner });
    return data.node_id ?? null;
  } catch {
    return null;
  }
}

/**
 * プロジェクトのワークフロー一覧を取得する。
 * GitHub Projects V2 のビルトイン自動化を確認するために使用。
 *
 * @param projectId - プロジェクトの GraphQL Node ID
 * @returns ワークフロー配列。取得失敗時は空配列
 *
 * @example
 * ```typescript
 * const workflows = await fetchWorkflows(projectId)
 * const enabled = workflows.filter(w => w.enabled)
 * ```
 *
 * @category Project
 */
export async function fetchWorkflows(projectId: string): Promise<ProjectWorkflow[]> {
  const detail = await fetchWorkflowsWithProject(projectId);
  return detail?.workflows ?? [];
}

/**
 * ワークフロー一覧と、deep-link を組み立てるためのプロジェクト本体情報をまとめて取得する。
 *
 * ワークフロー設定ページの URL（`{project.url}/workflows`）は GitHub API では
 * 自動有効化できない（`updateProjectV2Workflow` mutation が未公開）ため、
 * 利用者にコピー & ペースト可能な deep-link を提示する用途で使う。#2325
 *
 * @param projectId - プロジェクトの GraphQL Node ID
 * @returns 取得失敗時は null
 */
export async function fetchWorkflowsWithProject(projectId: string): Promise<{
  number?: number;
  url?: string;
  title?: string;
  workflows: ProjectWorkflow[];
} | null> {
  interface WorkflowNode {
    id?: string;
    name?: string;
    number?: number;
    enabled?: boolean;
  }

  interface QueryResult {
    data?: {
      node?: {
        title?: string;
        number?: number;
        url?: string;
        workflows?: {
          nodes?: WorkflowNode[];
        };
      };
    };
  }

  const result = await runGraphQL<QueryResult>(GRAPHQL_QUERY_WORKFLOWS, { projectId });
  if (!result.success) return null;

  const node = result.data?.data?.node;
  if (!node) return null;

  const nodes = node.workflows?.nodes ?? [];
  const workflows = nodes
    .filter((n): n is Required<WorkflowNode> => !!n?.id && !!n?.name && n.number !== undefined && n.enabled !== undefined)
    .map((n) => ({
      id: n.id,
      name: n.name,
      number: n.number,
      enabled: n.enabled,
    }));

  return {
    number: node.number,
    url: node.url,
    title: node.title,
    workflows,
  };
}
