/**
 * items shared utilities
 *
 * Types, constants, and helper functions used by items subcommands.
 */

import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import { Logger } from "../../../utils/logger.js";
import {
  runGraphQL,
  getRepoInfo,
  GhResult,
} from "../../../utils/github.js";
import { getOctokit } from "../../../utils/octokit-client.js";
import { getCurrentBranch } from "../../../utils/git-local.js";
import { parseLinkedIssues } from "../../pr/helpers.js";
import {
  type ProjectField,
} from "../../../utils/project-fields.js";
import { updateProjectStatus } from "../../../utils/issue-detail.js";

// =============================================================================
// Types
// =============================================================================

// Re-export from shared location for subcommand handlers
export { DEFAULT_EXCLUDE_STATUSES } from "../../../utils/status-workflow.js";

/** Git repository state (branch + uncommitted changes) */
export interface GitState {
  currentBranch: string | null;
  uncommittedChanges: string[];
  hasUncommittedChanges: boolean;
}

/** Extended git state for preflight checks */
export interface PreflightGitState {
  branch: string | null;
  baseBranch: string | null;
  isFeatureBranch: boolean;
  uncommittedChanges: string[];
  hasUncommittedChanges: boolean;
  unpushedCommits: number | null;
  recentCommits: Array<{ hash: string; message: string }>;
}

/** Flattened issue info for preflight JSON output (snake_case) */
export interface PreflightIssue {
  number: number;
  title: string;
  status: string | null;
  merged_pr: boolean | null;
}

/** Flattened PR info for preflight JSON output (snake_case) */
export interface PreflightPr {
  number: number;
  title: string;
  review_decision: string | null;
}

/** Full preflight JSON output structure (snake_case) */
export interface PreflightOutput {
  repository: string;
  git: {
    branch: string | null;
    base_branch: string | null;
    is_feature_branch: boolean;
    uncommitted_changes: number;
    unpushed_commits: number | null;
    recent_commits: Array<{ hash: string; message: string }>;
  };
  issues: PreflightIssue[];
  pull_requests: PreflightPr[];
  session_backups: number;
  warnings: string[];
}

export interface IssueData {
  number: number;
  title: string;
  url: string;
  state: string;
  closedAt: string | null;
  labels: string[];
  assignees: string[];
  status: string | null;
  priority: string | null;
  size: string | null;
  projectItemId: string | null;
  projectId: string | null;
  /** 親 Issue 番号（サブ Issue の場合のみ）。integrity チェックで使用 */
  parentNumber?: number;
}

/** Session backup metadata returned by getSessionBackups */
export interface SessionBackup {
  filename: string;
  timestamp: string;
  content: string;
}

// =============================================================================
// GraphQL Queries - Issues with Projects
// =============================================================================

/** Fetch issues with project field data */
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
        closedAt
        parent { number }
        assignees(first: 5) {
          nodes { login }
        }
        labels(first: 10) {
          nodes { name }
        }
        projectItems(first: 5) {
          nodes {
            id
            project { id title }
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
// Constants
// =============================================================================

const SESSIONS_DIR = ".claude/sessions";
const BACKUP_SUFFIX = "-precompact-backup.md";
export const PROTECTED_BRANCHES = ["main", "develop"];

// =============================================================================
// Helper: Get current GitHub username
// =============================================================================

export async function getCurrentUsername(): Promise<string | null> {
  try {
    const octokit = getOctokit();
    const { data } = await octokit.rest.users.getAuthenticated();
    return data.login ?? null;
  } catch {
    return null;
  }
}

// =============================================================================
// Helper: Fetch issues with project fields
// =============================================================================

export async function fetchActiveIssues(
  owner: string,
  repo: string,
  limit: number,
  states: string[] = ["OPEN"]
): Promise<IssueData[]> {
  interface IssueNode {
    number?: number;
    title?: string;
    url?: string;
    state?: string;
    closedAt?: string;
    parent?: { number?: number } | null;
    assignees?: { nodes?: Array<{ login?: string }> };
    labels?: { nodes?: Array<{ name?: string }> };
    projectItems?: {
      nodes?: Array<{
        id?: string;
        project?: { id?: string; title?: string };
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

  const allIssues: IssueData[] = [];
  let cursor: string | null = null;

  while (allIssues.length < limit) {
    const fetchCount = Math.min(100, limit - allIssues.length);

    const result: GhResult<QueryResult> = await runGraphQL<QueryResult>(
      GRAPHQL_QUERY_ISSUES_WITH_PROJECTS,
      {
        owner,
        name: repo,
        first: fetchCount,
        cursor: cursor,
        states,
      }
    );

    if (!result.success || !result.data?.data?.repository?.issues) break;

    type IssuesData = NonNullable<NonNullable<NonNullable<QueryResult["data"]>["repository"]>["issues"]>;
    const issuesData: IssuesData = result.data.data.repository.issues;
    const nodes: IssueNode[] = issuesData.nodes ?? [];

    for (const node of nodes) {
      if (!node?.number) continue;

      // Match project item by repo name convention, fallback to first item
      type ProjectItemNode = NonNullable<NonNullable<IssueNode["projectItems"]>["nodes"]>[number];
      const projectItems: ProjectItemNode[] = node.projectItems?.nodes ?? [];
      const matchingItem = projectItems.find((p: ProjectItemNode) => p?.project?.title === repo) ?? projectItems[0];

      type LabelNode = NonNullable<NonNullable<IssueNode["labels"]>["nodes"]>[number];
      const labelNodes: LabelNode[] = node.labels?.nodes ?? [];
      const issueLabels = labelNodes.map((l: LabelNode) => l?.name ?? "").filter(Boolean);

      type AssigneeNode = NonNullable<NonNullable<IssueNode["assignees"]>["nodes"]>[number];
      const assigneeNodes: AssigneeNode[] = node.assignees?.nodes ?? [];
      const issueAssignees = assigneeNodes.map((a: AssigneeNode) => a?.login ?? "").filter(Boolean);

      const parentNum = node.parent?.number;
      allIssues.push({
        number: node.number,
        title: node.title ?? "",
        url: node.url ?? "",
        state: node.state ?? "OPEN",
        closedAt: node.closedAt ?? null,
        labels: issueLabels,
        assignees: issueAssignees,
        status: matchingItem?.status?.name ?? null,
        priority: matchingItem?.priority?.name ?? null,
        size: matchingItem?.size?.name ?? null,
        projectItemId: matchingItem?.id ?? null,
        projectId: matchingItem?.project?.id ?? null,
        parentNumber: typeof parentNum === "number" ? parentNum : undefined,
      });
    }

    const pageInfo: { hasNextPage?: boolean; endCursor?: string } = issuesData.pageInfo ?? {};
    if (!pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor ?? null;
  }

  return allIssues;
}

// =============================================================================
// Helper: Update issue status in project (#676: updateProjectStatus に委任)
// =============================================================================

export async function updateIssueStatus(
  projectId: string,
  itemId: string,
  statusValue: string,
  projectFields: Record<string, ProjectField>,
  logger: Logger,
): Promise<boolean> {
  const result = await updateProjectStatus({
    projectId,
    itemId,
    statusValue,
    projectFields,
    logger,
  });
  return result.success;
}

// =============================================================================
// PR merge detection (#220)
// =============================================================================

/**
 * Issue に紐づくマージ済み PR を検出する。
 *
 * 検出戦略:
 * 1. ブランチ名検索: 現在のブランチに対応する merged PR を探す
 * 2. Issue リンク逆引き: マージ済み PR の body から "Closes #N" 等を検索
 *
 * @returns マージ済み PR 番号。見つからない場合は null
 */
export async function findMergedPrForIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  logger: Logger
): Promise<number | null> {
  const octokit = getOctokit();

  // Strategy 1: ブランチ名ベースの検出
  // 現在のブランチに紐づくマージ済み PR を探す
  try {
    const currentBranch = getCurrentBranch();

    const baseBranches = ["main", "master", "develop"];
    if (currentBranch && !baseBranches.includes(currentBranch)) {
      const { data } = await octokit.rest.pulls.list({
        owner,
        repo,
        head: `${owner}:${currentBranch}`,
        state: "closed",
        per_page: 5,
      });

      // merged_at が非 null のものだけがマージ済み
      const merged = data.filter((pr) => pr.merged_at !== null);
      if (merged.length > 0) {
        const prNum = merged[0].number;
        logger.debug(`Merged PR #${prNum} found for branch ${currentBranch}`);
        return prNum;
      }
    }
  } catch {
    // git コマンド失敗時は次の戦略へ
  }

  // Strategy 2: Issue リンク逆引き
  // サーバーサイド検索で対象 Issue への参照を含むマージ済み PR を探す
  try {
    const { data } = await octokit.rest.search.issuesAndPullRequests({
      q: `is:pr is:merged #${issueNumber} repo:${owner}/${repo}`,
      per_page: 10,
    });

    for (const item of data.items) {
      const linked = parseLinkedIssues(item.body ?? undefined);
      if (linked.includes(issueNumber)) {
        logger.debug(`Merged PR #${item.number} links to issue #${issueNumber}`);
        return item.number;
      }
    }
  } catch {
    // 検索 API 失敗時はスキップ
  }

  return null;
}

// =============================================================================
// Helper: Check if an issue is closed (REST API)
// =============================================================================

/**
 * Issue が CLOSED かどうかを REST API で確認する。
 * OPEN-only fetch で見つからない Issue 番号の判定に使用。
 * API 失敗時は false を返し、従来の warn 動作にフォールバック（安全側）。
 */
export async function isIssueClosed(owner: string, repo: string, num: number): Promise<boolean> {
  try {
    const octokit = getOctokit();
    const { data } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: num,
    });
    return data.state === "closed";
  } catch {
    return false;
  }
}

// =============================================================================
// Git state helpers
// =============================================================================

/**
 * Get current git repository state (branch + uncommitted changes).
 * Returns safe defaults if git commands fail.
 *
 * @returns ブランチ名と未コミット変更リスト。git 未使用時はデフォルト値を返す
 */
export async function getGitState(logger?: Logger): Promise<GitState> {
  let currentBranch: string | null = null;
  let uncommittedChanges: string[] = [];

  try {
    currentBranch = getCurrentBranch();
  } catch (e) {
    logger?.debug(`getGitState: getCurrentBranch failed: ${String(e)}`);
  }

  try {
    const git = simpleGit();
    const status = await git.status();
    // simple-git の status から変更ファイルリストを構築
    const files = status.files.map((f) => `${f.working_dir}${f.index} ${f.path}`);
    if (files.length > 0) {
      uncommittedChanges = files;
    }
  } catch (e) {
    logger?.debug(`getGitState: git status failed: ${String(e)}`);
  }

  return {
    currentBranch,
    uncommittedChanges,
    hasUncommittedChanges: uncommittedChanges.length > 0,
  };
}

// =============================================================================
// Preflight git state (#861)
// =============================================================================

/**
 * Get extended git state for preflight checks.
 * Includes base branch detection, unpushed commit count, and recent commits.
 *
 * @returns 拡張 git 状態（ベースブランチ、未プッシュコミット数、最近のコミット含む）
 * @see getGitState 基本 git 状態の取得
 */
export async function getPreflightGitState(logger?: Logger): Promise<PreflightGitState> {
  const basic = await getGitState(logger);
  const branch = basic.currentBranch;

  // Base branch detection
  let baseBranch: string | null = null;
  try {
    const git = simpleGit();
    const result = await git.raw(["symbolic-ref", "refs/remotes/origin/HEAD"]);
    if (result?.trim()) {
      baseBranch = result.trim().replace(/^refs\/remotes\/origin\//, "");
    }
  } catch (e) {
    logger?.debug(`getPreflightGitState: git symbolic-ref failed: ${String(e)}`);
  }
  if (!baseBranch) {
    try {
      const repoInfo = getRepoInfo();
      if (repoInfo) {
        const octokit = getOctokit();
        const { data } = await octokit.rest.repos.get({
          owner: repoInfo.owner,
          repo: repoInfo.name,
        });
        baseBranch = data.default_branch ?? null;
      }
    } catch (e) {
      logger?.debug(`getPreflightGitState: octokit repos.get failed: ${String(e)}`);
    }
  }

  // isFeatureBranch
  const isFeatureBranch = branch !== null && !PROTECTED_BRANCHES.includes(branch);

  // Unpushed commits
  let unpushedCommits: number | null = null;
  try {
    const git = simpleGit();
    const result = await git.raw(["rev-list", "@{u}..HEAD", "--count"]);
    if (result?.trim()) {
      unpushedCommits = parseInt(result.trim(), 10);
      if (isNaN(unpushedCommits)) unpushedCommits = null;
    }
  } catch (e) {
    logger?.debug(`getPreflightGitState: git rev-list @{u}..HEAD failed: ${String(e)}`);
  }

  // Recent commits (max 10)
  const recentCommits: Array<{ hash: string; message: string }> = [];
  try {
    const git = simpleGit();
    const logResult = await git.log({ maxCount: 10 });
    for (const entry of logResult.all) {
      recentCommits.push({
        hash: entry.hash.slice(0, 7),
        message: entry.message,
      });
    }
  } catch (e) {
    logger?.debug(`getPreflightGitState: git log failed: ${String(e)}`);
  }

  return {
    branch,
    baseBranch,
    isFeatureBranch,
    uncommittedChanges: basic.uncommittedChanges,
    hasUncommittedChanges: basic.hasUncommittedChanges,
    unpushedCommits,
    recentCommits,
  };
}

// =============================================================================
// Shared git warning generation
// =============================================================================

/**
 * Generate warnings from git state.
 * Shared by `git check` and `items preflight`.
 *
 * @param state - Preflight git state
 * @param unpushedSuffix - Context-specific suffix for unpushed warning
 * @returns Warning messages array
 */
export function generateGitWarnings(
  state: PreflightGitState,
  unpushedSuffix: string = "detected.",
): string[] {
  const warnings: string[] = [];

  if (state.branch && PROTECTED_BRANCHES.includes(state.branch)) {
    warnings.push(
      `On protected branch "${state.branch}". Create a feature branch before committing.`
    );
  }

  if (state.hasUncommittedChanges) {
    warnings.push(
      `${state.uncommittedChanges.length} uncommitted change(s) detected.`
    );
  }

  if (state.unpushedCommits !== null && state.unpushedCommits > 0) {
    warnings.push(
      `${state.unpushedCommits} unpushed commit(s) ${unpushedSuffix}`
    );
  }

  return warnings;
}

// =============================================================================
// Session backup helpers (#251)
// =============================================================================

/**
 * Check for PreCompact session backups in .claude/sessions/.
 * Returns backups sorted by timestamp (most recent first).
 */
export function getSessionBackups(): SessionBackup[] {
  if (!existsSync(SESSIONS_DIR)) return [];

  try {
    const files = readdirSync(SESSIONS_DIR)
      .filter((f) => f.endsWith(BACKUP_SUFFIX))
      .sort()
      .reverse();

    return files.map((f) => ({
      filename: f,
      timestamp: f.replace(BACKUP_SUFFIX, ""),
      content: readFileSync(join(SESSIONS_DIR, f), "utf-8"),
    }));
  } catch {
    return [];
  }
}

/**
 * Remove all PreCompact session backups from .claude/sessions/.
 * Called after a successful session checkpoint to prevent stale backups.
 *
 * @returns Number of files cleaned up
 */
export function cleanupSessionBackups(): number {
  if (!existsSync(SESSIONS_DIR)) return 0;

  try {
    const files = readdirSync(SESSIONS_DIR).filter((f) =>
      f.endsWith(BACKUP_SUFFIX)
    );

    for (const f of files) {
      unlinkSync(join(SESSIONS_DIR, f));
    }
    return files.length;
  } catch {
    return 0;
  }
}
