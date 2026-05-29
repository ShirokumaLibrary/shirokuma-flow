/**
 * items context サブコマンド (#2024 Phase 1)
 *
 * 指定された Issue / PR を起点に関連情報を一括取得し、JSON で出力する。
 *
 * 取得内容:
 * - 対象 Issue / PR の本文・ステータス・ラベル・担当者
 * - 親 Issue（あれば）
 * - 子 Issue（あれば）
 * - 本文からリンクされた Discussion
 * - 関連 PR（Closes #{N} の逆引き）
 * - 各アイテムの最新コメント
 *
 * #2792 (ADR-v3-025): `.shirokuma/cache/` の読み書きは廃止。読み取りは常に API 直取得。
 * #2797: write-through として `.shirokuma/github/` に最新データを書き込む（スキルが body.md を Read できるよう）。
 */

import { runGraphQL, parseIssueNumber, isIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { writeCache } from "../../../utils/github-cache.js";
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../../items/types.js";

// =============================================================================
// オプション型
// =============================================================================

/**
 * items context サブコマンドのオプション
 *
 * ADR-v3-025 / #2792: 読み取りは常に API 直取得。`--no-cache` / `--refresh` フラグは廃止。
 * #2797: API 取得後に .shirokuma/github/ へ write-through する。
 */
type ContextOptions = ItemsOptions;

// =============================================================================
// GraphQL クエリ定義
// =============================================================================

/** Issue の関連情報を一括取得するクエリ */
const GRAPHQL_QUERY_ISSUE_CONTEXT = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      number
      title
      body
      state
      url
      updatedAt
      issueType { name }
      labels(first: 20) { nodes { name } }
      assignees(first: 10) { nodes { login } }
      parent {
        number
        title
        state
        projectItems(first: 5) {
          nodes {
            status: fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue { name }
            }
          }
        }
      }
      subIssues(first: 50) {
        nodes {
          number
          title
          state
          labels(first: 10) { nodes { name } }
          projectItems(first: 5) {
            nodes {
              status: fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
            }
          }
        }
      }
      subIssuesSummary {
        total
        completed
        percentCompleted
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
      timelineItems(first: 5, itemTypes: [CONNECTED_EVENT]) {
        nodes {
          ... on ConnectedEvent {
            subject {
              ... on PullRequest {
                number
                title
                state
                baseRefName
                headRefName
              }
            }
          }
        }
      }
      comments(last: 3) {
        nodes {
          databaseId
          author { login }
          body
          createdAt
        }
      }
    }
  }
}
`;

/** PR の関連情報を一括取得するクエリ */
const GRAPHQL_QUERY_PR_CONTEXT = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number
      title
      body
      state
      url
      updatedAt
      baseRefName
      headRefName
      labels(first: 20) { nodes { name } }
      assignees(first: 10) { nodes { login } }
      projectItems(first: 5) {
        nodes {
          id
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
          }
        }
      }
      closingIssuesReferences(first: 10) {
        nodes {
          number
          title
          state
        }
      }
      comments(last: 3) {
        nodes {
          databaseId
          author { login }
          body
          createdAt
        }
      }
    }
  }
}
`;

/** Discussion の情報を取得するクエリ */
const GRAPHQL_QUERY_DISCUSSION_CONTEXT = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
      number
      title
      body
      url
      category { name }
    }
  }
}
`;

// =============================================================================
// 型定義
// =============================================================================

interface ProjectStatus {
  name?: string;
  optionId?: string;
}

interface ProjectItemNode {
  id?: string;
  project?: { id?: string; title?: string };
  status?: ProjectStatus | null;
  priority?: ProjectStatus | null;
  size?: ProjectStatus | null;
}

interface SubIssueNode {
  number?: number;
  title?: string;
  state?: string;
  labels?: { nodes?: Array<{ name?: string }> };
  projectItems?: { nodes?: ProjectItemNode[] };
}

interface CommentNode {
  databaseId?: number;
  author?: { login?: string };
  body?: string;
  createdAt?: string;
}

interface ConnectedPR {
  number?: number;
  title?: string;
  state?: string;
  baseRefName?: string;
  headRefName?: string;
}

interface IssueContextQueryResult {
  data?: {
    repository?: {
      issue?: {
        number?: number;
        title?: string;
        body?: string;
        state?: string;
        url?: string;
        updatedAt?: string;
        issueType?: { name?: string };
        labels?: { nodes?: Array<{ name?: string }> };
        assignees?: { nodes?: Array<{ login?: string }> };
        parent?: {
          number?: number;
          title?: string;
          state?: string;
          projectItems?: { nodes?: ProjectItemNode[] };
        } | null;
        subIssues?: { nodes?: SubIssueNode[] };
        subIssuesSummary?: {
          total?: number;
          completed?: number;
          percentCompleted?: number;
        } | null;
        projectItems?: { nodes?: ProjectItemNode[] };
        timelineItems?: {
          nodes?: Array<{
            subject?: ConnectedPR;
          }>;
        };
        comments?: { nodes?: CommentNode[] };
      };
    };
  };
}

interface PRContextQueryResult {
  data?: {
    repository?: {
      pullRequest?: {
        number?: number;
        title?: string;
        body?: string;
        state?: string;
        url?: string;
        updatedAt?: string;
        baseRefName?: string;
        headRefName?: string;
        labels?: { nodes?: Array<{ name?: string }> };
        assignees?: { nodes?: Array<{ login?: string }> };
        projectItems?: { nodes?: ProjectItemNode[] };
        closingIssuesReferences?: {
          nodes?: Array<{ number?: number; title?: string; state?: string }>;
        };
        comments?: { nodes?: CommentNode[] };
      };
    };
  };
}

interface DiscussionContextQueryResult {
  data?: {
    repository?: {
      discussion?: {
        number?: number;
        title?: string;
        body?: string;
        url?: string;
        category?: { name?: string };
      };
    };
  };
}

// =============================================================================
// コンテキストデータ型（キャッシュと返却に使用）
// =============================================================================

interface ContextTarget {
  number: number;
  type: "issue" | "pull_request";
  title: string;
  body: string;
  status?: string;
  labels: string[];
  assignees: string[];
}

export interface ContextParent {
  number: number;
  title: string;
  status?: string;
}

export interface ContextChild {
  number: number;
  title: string;
  status?: string;
}

export interface ContextDiscussion {
  number: number;
  category: string;
  title: string;
  url: string;
}

export interface ContextPR {
  number: number;
  title: string;
  state: string;
  base: string;
  head: string;
}

export interface ContextComment {
  source: string;
  author: string;
  body: string;
  created_at: string;
}

export interface ContextData {
  target: ContextTarget;
  parent: ContextParent | null;
  children: ContextChild[];
  discussions: ContextDiscussion[];
  pull_requests: ContextPR[];
  recent_comments: ContextComment[];
}

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * Issue 本文から Discussion へのリンクを検出する。
 * 検出パターン:
 * - https://github.com/{owner}/{repo}/discussions/{number}
 * - #D{number}（shirokuma-flow 独自記法）
 */
function extractDiscussionNumbers(body: string, owner: string, repo: string): number[] {
  const numbers: number[] = [];

  // フル URL パターン
  const urlPattern = new RegExp(
    `https://github\\.com/${owner}/${repo}/discussions/(\\d+)`,
    "g"
  );
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(body)) !== null) {
    const num = parseInt(match[1], 10);
    if (!numbers.includes(num)) numbers.push(num);
  }

  // #D{number} パターン（shirokuma-flow 独自記法）
  const shortPattern = /#D(\d+)/g;
  while ((match = shortPattern.exec(body)) !== null) {
    const num = parseInt(match[1], 10);
    if (!numbers.includes(num)) numbers.push(num);
  }

  return numbers;
}

/**
 * Project Items から現在のステータスを取得する。
 */
function extractStatusFromProjectItems(
  projectItems: ProjectItemNode[] | undefined
): string | undefined {
  if (!projectItems) return undefined;
  for (const item of projectItems) {
    if (item.status?.name) return item.status.name;
  }
  return undefined;
}

// =============================================================================
// コマンドエントリポイント
// =============================================================================

/**
 * items context サブコマンド
 *
 * Issue / PR を起点に関連情報を一括取得して返す。
 */
export async function cmdItemContext(
  numberStr: string,
  options: ContextOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(numberStr)) {
    logger.error("有効なアイテム番号を指定してください");
    return 1;
  }

  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("リポジトリを特定できません");
    return 1;
  }

  const { owner, name: repo } = repoInfo;
  const number = parseIssueNumber(numberStr);

  // ADR-v3-025 / #2792: 読み取りは常に API 直取得。キャッシュ層は廃止された。

  // Issue として取得を試みる
  const issueResult = await runGraphQL<IssueContextQueryResult>(
    GRAPHQL_QUERY_ISSUE_CONTEXT,
    { owner, name: repo, number }
  );

  if (issueResult.success) {
    const issue = issueResult.data?.data?.repository?.issue;
    if (issue?.number) {
      return await processIssueContext(issue, owner, repo, number, logger);
    }
  }

  // PR として取得を試みる
  const prResult = await runGraphQL<PRContextQueryResult>(
    GRAPHQL_QUERY_PR_CONTEXT,
    { owner, name: repo, number }
  );

  if (prResult.success) {
    const pr = prResult.data?.data?.repository?.pullRequest;
    if (pr?.number) {
      return await processPRContext(pr, owner, repo, number, logger);
    }
  }

  logger.error(`#${number} が見つかりません（Issue または PR として取得を試みましたが見つかりませんでした）`);
  return 1;
}

/**
 * Issue コンテキストを処理して JSON で出力する。
 */
async function processIssueContext(
  issue: NonNullable<NonNullable<NonNullable<IssueContextQueryResult["data"]>["repository"]>["issue"]>,
  owner: string,
  repo: string,
  number: number,
  logger: Logger
): Promise<number> {
  const projectItems = issue.projectItems?.nodes ?? [];
  const status = extractStatusFromProjectItems(projectItems);

  // 対象 Issue の情報を整形
  const target: ContextTarget = {
    number: issue.number ?? number,
    type: "issue",
    title: issue.title ?? "",
    body: issue.body ?? "",
    status,
    labels: (issue.labels?.nodes ?? []).map((l) => l.name ?? "").filter(Boolean),
    assignees: (issue.assignees?.nodes ?? []).map((a) => a.login ?? "").filter(Boolean),
  };

  // write-through: .shirokuma/github/ に最新データを書き込む（スキルの Read が常に最新値を参照できるよう）
  // 書き込み失敗（CI サンドボックス・権限エラー等）は主出力（JSON）に影響させない
  try {
    const firstItem = projectItems[0];
    const priority = firstItem?.priority?.name;
    const size = firstItem?.size?.name;
    const parentNumber = issue.parent?.number;
    const rawSummary = issue.subIssuesSummary;
    const subIssuesSummary = rawSummary
      ? {
          total: rawSummary.total ?? 0,
          completed: rawSummary.completed ?? 0,
          percentCompleted: rawSummary.percentCompleted ?? 0,
        }
      : undefined;
    writeCache(number, {
      number,
      type: "issue",
      updated_at: issue.updatedAt,
      title: target.title,
      status,
      priority,
      size,
      labels: target.labels.length > 0 ? target.labels : undefined,
      assignees: target.assignees.length > 0 ? target.assignees : undefined,
      issue_type: issue.issueType?.name,
      state: issue.state,
      parent: parentNumber,
      subIssuesSummary,
    }, target.body, owner, repo);
  } catch {
    // best-effort: write-through 失敗はサイレントに無視する
  }

  // 親 Issue の整形
  let parent: ContextParent | null = null;
  if (issue.parent?.number) {
    const parentProjectItems = issue.parent.projectItems?.nodes ?? [];
    const parentStatus = extractStatusFromProjectItems(parentProjectItems);
    parent = {
      number: issue.parent.number,
      title: issue.parent.title ?? "",
      status: parentStatus,
    };
  }

  // 子 Issue の整形
  const children: ContextChild[] = (issue.subIssues?.nodes ?? []).map((child) => {
    const childStatus = extractStatusFromProjectItems(child.projectItems?.nodes);
    return {
      number: child.number ?? 0,
      title: child.title ?? "",
      status: childStatus,
    };
  }).filter((c) => c.number > 0);

  // Discussion リンクの検出と取得
  const discussions = await fetchLinkedDiscussions(
    target.body,
    owner,
    repo,
    logger
  );

  // 関連 PR の整形（timelineItems から）
  const pullRequests: ContextPR[] = (issue.timelineItems?.nodes ?? [])
    .map((node) => node.subject)
    .filter((pr): pr is ConnectedPR => pr !== undefined && pr.number !== undefined)
    .map((pr) => ({
      number: pr.number ?? 0,
      title: pr.title ?? "",
      state: pr.state ?? "",
      base: pr.baseRefName ?? "",
      head: pr.headRefName ?? "",
    }))
    .filter((pr) => pr.number > 0);

  // 最新コメントの整形
  const recentComments: ContextComment[] = (issue.comments?.nodes ?? []).map((comment) => ({
    source: `#${number}`,
    author: comment.author?.login ?? "unknown",
    body: comment.body ?? "",
    created_at: comment.createdAt ?? "",
  }));

  // コンテキストデータをまとめる
  const contextData: ContextData = {
    target,
    parent,
    children,
    discussions,
    pull_requests: pullRequests,
    recent_comments: recentComments,
  };

  logger.success(`Issue #${number} のコンテキストを取得しました`);
  console.log(JSON.stringify(contextData, null, 2));
  return 0;
}

/**
 * PR コンテキストを処理する。
 */
async function processPRContext(
  pr: NonNullable<NonNullable<NonNullable<PRContextQueryResult["data"]>["repository"]>["pullRequest"]>,
  owner: string,
  repo: string,
  number: number,
  logger: Logger
): Promise<number> {
  // 対象 PR の情報を整形
  const target: ContextTarget = {
    number: pr.number ?? number,
    type: "pull_request",
    title: pr.title ?? "",
    body: pr.body ?? "",
    labels: (pr.labels?.nodes ?? []).map((l) => l.name ?? "").filter(Boolean),
    assignees: (pr.assignees?.nodes ?? []).map((a) => a.login ?? "").filter(Boolean),
  };

  // write-through: .shirokuma/github/ に最新データを書き込む
  // 書き込み失敗は主出力（JSON）に影響させない
  try {
    const prStatus = extractStatusFromProjectItems(pr.projectItems?.nodes ?? []);
    writeCache(number, {
      number,
      type: "pull_request",
      updated_at: pr.updatedAt,
      title: target.title,
      status: prStatus,
      labels: target.labels.length > 0 ? target.labels : undefined,
      assignees: target.assignees.length > 0 ? target.assignees : undefined,
    }, target.body, owner, repo);
  } catch {
    // best-effort: write-through 失敗はサイレントに無視する
  }

  // 関連 Issue の整形（Closes #{N}）
  const closingIssues = (pr.closingIssuesReferences?.nodes ?? []).map((issue) => ({
    number: issue.number ?? 0,
    title: issue.title ?? "",
    status: undefined as string | undefined,
  })).filter((i) => i.number > 0);

  // Discussion リンクの検出と取得
  const discussions = await fetchLinkedDiscussions(
    target.body,
    owner,
    repo,
    logger
  );

  // 最新コメントの整形
  const recentComments: ContextComment[] = (pr.comments?.nodes ?? []).map((comment) => ({
    source: `#${number}`,
    author: comment.author?.login ?? "unknown",
    body: comment.body ?? "",
    created_at: comment.createdAt ?? "",
  }));

  const contextData: ContextData = {
    target,
    parent: null,
    children: closingIssues,
    discussions,
    pull_requests: [{
      number: pr.number ?? number,
      title: pr.title ?? "",
      state: pr.state ?? "",
      base: pr.baseRefName ?? "",
      head: pr.headRefName ?? "",
    }],
    recent_comments: recentComments,
  };

  logger.success(`PR #${number} のコンテキストを取得しました`);
  console.log(JSON.stringify(contextData, null, 2));
  return 0;
}

/**
 * Issue / PR 本文からリンクされた Discussion を取得する。
 */
async function fetchLinkedDiscussions(
  body: string,
  owner: string,
  repo: string,
  logger: Logger
): Promise<ContextDiscussion[]> {
  const discussionNumbers = extractDiscussionNumbers(body, owner, repo);
  const discussions: ContextDiscussion[] = [];

  for (const discNum of discussionNumbers) {
    const result = await runGraphQL<DiscussionContextQueryResult>(
      GRAPHQL_QUERY_DISCUSSION_CONTEXT,
      { owner, name: repo, number: discNum }
    );

    if (result.success) {
      const disc = result.data?.data?.repository?.discussion;
      if (disc?.number) {
        const discussionData: ContextDiscussion = {
          number: disc.number,
          category: disc.category?.name ?? "General",
          title: disc.title ?? "",
          url: disc.url ?? `https://github.com/${owner}/${repo}/discussions/${discNum}`,
        };
        discussions.push(discussionData);
      }
    } else {
      logger.warn(`Discussion #${discNum} の取得に失敗しました`);
    }
  }

  return discussions;
}
