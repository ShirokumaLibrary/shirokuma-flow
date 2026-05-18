/**
 * items search サブコマンド (#1814, #1818)
 *
 * issues search から移行。Issue と PR をキーワード検索する。
 * --type オプションで issues / discussions / both を切り替え可能 (#1818)。
 */

import { runGraphQL } from "../../../utils/github.js";
import {
  formatOutput,
  GH_ISSUES_SEARCH_COLUMNS,
  GH_DISCUSSIONS_SEARCH_COLUMNS,
  toTableJson,
} from "../../../utils/formatters.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { stripDoubleQuotes } from "../../../utils/sanitize.js";
import type { Logger } from "../../../utils/logger.js";
import type { SearchOptions } from "../../items/types.js";

// =============================================================================
// 型定義
// =============================================================================

/** 検索対象タイプ */
type SearchType = "issues" | "discussions";

/** 有効な検索タイプ */
const VALID_TYPES: readonly SearchType[] = ["issues", "discussions"];

// =============================================================================
// GraphQL Queries
// =============================================================================

const GRAPHQL_QUERY_SEARCH_ISSUES = `
query($searchQuery: String!, $first: Int!) {
  search(query: $searchQuery, type: ISSUE, first: $first) {
    issueCount
    nodes {
      ... on Issue {
        __typename
        number
        title
        url
        state
        createdAt
        updatedAt
        author { login }
      }
      ... on PullRequest {
        __typename
        number
        title
        url
        state
        createdAt
        updatedAt
        author { login }
      }
    }
  }
}
`;

const GRAPHQL_QUERY_SEARCH_DISCUSSIONS = `
query($searchQuery: String!, $first: Int!) {
  search(query: $searchQuery, type: DISCUSSION, first: $first) {
    discussionCount
    nodes {
      ... on Discussion {
        id
        number
        title
        url
        createdAt
        updatedAt
        author { login }
        category { name }
        answerChosenAt
      }
    }
  }
}
`;

// =============================================================================
// GraphQL クエリビルダー（combined query）
// =============================================================================

/**
 * issues + discussions の両方を同時検索するクエリを構築する。
 * どちらかのみの場合は単独クエリを使用する。
 */
function buildCombinedGraphQLQuery(types: Set<SearchType>): string {
  const fragments: string[] = [];

  if (types.has("issues")) {
    fragments.push(`
    issueSearch: search(query: $issueQuery, type: ISSUE, first: $first) {
      issueCount
      nodes {
        ... on Issue {
          __typename
          number
          title
          url
          state
          createdAt
          updatedAt
          author { login }
        }
        ... on PullRequest {
          __typename
          number
          title
          url
          state
          createdAt
          updatedAt
          author { login }
        }
      }
    }`);
  }

  if (types.has("discussions")) {
    fragments.push(`
    discussionSearch: search(query: $discussionQuery, type: DISCUSSION, first: $first) {
      discussionCount
      nodes {
        ... on Discussion {
          number
          title
          url
          createdAt
          updatedAt
          author { login }
          category { name }
          answerChosenAt
        }
      }
    }`);
  }

  const vars: string[] = ["$first: Int!"];
  if (types.has("issues")) vars.push("$issueQuery: String!");
  if (types.has("discussions")) vars.push("$discussionQuery: String!");

  return `query(${vars.join(", ")}) {${fragments.join("")}\n}`;
}

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * --type オプションをパースし、検索対象の Set を返す。
 * 不正な値が含まれる場合はエラーを出して null を返す。
 */
function parseTypes(
  typeOption: string | undefined,
  logger: Logger
): Set<SearchType> | null {
  if (!typeOption) {
    return new Set<SearchType>(["issues"]);
  }

  const parts = typeOption.split(",").map((t) => t.trim().toLowerCase());
  const types = new Set<SearchType>();

  for (const part of parts) {
    if (!VALID_TYPES.includes(part as SearchType)) {
      logger.error(
        `Invalid search type: "${part}". Valid types: ${VALID_TYPES.join(", ")}`
      );
      return null;
    }
    types.add(part as SearchType);
  }

  if (types.size === 0) {
    logger.error("At least one search type is required");
    return null;
  }

  return types;
}

// =============================================================================
// Command
// =============================================================================

/**
 * items search サブコマンド
 */
export async function cmdSearch(
  options: SearchOptions,
  logger: Logger
): Promise<number> {
  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;

  // --type パース（デフォルト: issues のみ）
  const requestedTypes = parseTypes(options.type, logger);
  if (!requestedTypes) return 1;

  // --category バリデーション: issues のみの場合は警告
  if (options.category && !requestedTypes.has("discussions")) {
    logger.warn("--category is only applicable to discussions search, ignoring");
  }

  const limit = options.limit ?? 10;

  // issues と discussions 両方の場合は combined query で 1 リクエスト
  if (requestedTypes.has("issues") && requestedTypes.has("discussions")) {
    return cmdSearchCombined(owner, repo, options, limit, logger);
  }

  // issues のみ
  if (requestedTypes.has("issues")) {
    return cmdSearchIssues(owner, repo, options, limit, logger);
  }

  // discussions のみ
  return cmdSearchDiscussions(owner, repo, options, limit, logger);
}

// =============================================================================
// Issues 検索
// =============================================================================

interface IssueSearchNode {
  __typename?: string;
  number?: number;
  title?: string;
  url?: string;
  state?: string;
  createdAt?: string;
  updatedAt?: string;
  author?: { login?: string };
}

interface IssueSearchResult {
  data?: {
    search?: {
      issueCount?: number;
      nodes?: IssueSearchNode[];
    };
  };
}

async function cmdSearchIssues(
  owner: string,
  repo: string,
  options: SearchOptions,
  limit: number,
  logger: Logger
): Promise<number> {
  let searchQuery = `repo:${owner}/${repo}`;

  if (options.query) {
    searchQuery += ` ${options.query}`;
  }

  if (options.state && options.state !== "all") {
    const validStates = ["open", "closed"];
    if (validStates.includes(options.state)) {
      searchQuery += ` is:${options.state}`;
    }
  }

  const result = await runGraphQL<IssueSearchResult>(GRAPHQL_QUERY_SEARCH_ISSUES, {
    searchQuery,
    first: Math.min(limit, 100),
  });

  if (!result.success || !result.data?.data?.search) {
    logger.error("Search failed");
    return 1;
  }

  const searchData = result.data.data.search;
  const nodes = searchData.nodes ?? [];

  const issues = nodes
    .filter((n): n is Required<Pick<IssueSearchNode, 'number'>> & IssueSearchNode => !!n?.number)
    .map((n) => ({
      number: n.number,
      title: n.title ?? "",
      url: n.url ?? "",
      state: n.state ?? "",
      is_pr: n.__typename === "PullRequest",
      author: n.author?.login ?? "",
      created_at: n.createdAt ?? "",
    }));

  const output = {
    repository: `${owner}/${repo}`,
    query: options.query ?? "",
    state: options.state ?? null,
    issues,
    total_count: searchData.issueCount ?? issues.length,
  };

  const outputFormat = options.format ?? "table-json";
  const formatted = formatOutput(output, outputFormat, {
    arrayKey: "issues",
    columns: GH_ISSUES_SEARCH_COLUMNS,
  });
  console.log(formatted);
  return 0;
}

// =============================================================================
// Discussions 検索
// =============================================================================

interface DiscussionSearchNode {
  id?: string;
  number?: number;
  title?: string;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
  answerChosenAt?: string;
  author?: { login?: string };
  category?: { name?: string };
}

interface DiscussionSearchResult {
  data?: {
    search?: {
      discussionCount?: number;
      nodes?: DiscussionSearchNode[];
    };
  };
}

async function cmdSearchDiscussions(
  owner: string,
  repo: string,
  options: SearchOptions,
  limit: number,
  logger: Logger
): Promise<number> {
  let searchQuery = `repo:${owner}/${repo} type:discussion`;

  if (options.query) {
    searchQuery += ` ${options.query}`;
  }

  if (options.category) {
    searchQuery += ` category:"${stripDoubleQuotes(options.category)}"`;
  }

  const result = await runGraphQL<DiscussionSearchResult>(GRAPHQL_QUERY_SEARCH_DISCUSSIONS, {
    searchQuery,
    first: Math.min(limit, 100),
  });

  if (!result.success || !result.data?.data?.search) {
    logger.error("Search failed");
    return 1;
  }

  const searchData = result.data.data.search;
  const nodes = searchData.nodes ?? [];

  const discussions = nodes
    .filter((n): n is Required<Pick<DiscussionSearchNode, 'id' | 'number'>> & DiscussionSearchNode => !!n?.id && !!n?.number)
    .map((n) => ({
      number: n.number,
      title: n.title ?? "",
      url: n.url ?? "",
      category: n.category?.name ?? "",
      author: n.author?.login ?? "",
      answer_chosen: !!n.answerChosenAt,
      created_at: n.createdAt ?? "",
    }));

  const output = {
    repository: `${owner}/${repo}`,
    query: options.query ?? "",
    category: options.category ?? null,
    discussions,
    total_count: searchData.discussionCount ?? discussions.length,
  };

  const outputFormat = options.format ?? "table-json";
  const formatted = formatOutput(output, outputFormat, {
    arrayKey: "discussions",
    columns: GH_DISCUSSIONS_SEARCH_COLUMNS,
  });
  console.log(formatted);
  return 0;
}

// =============================================================================
// Combined 検索（issues + discussions 同時）
// =============================================================================

interface CombinedSearchResult {
  data?: {
    issueSearch?: {
      issueCount?: number;
      nodes?: IssueSearchNode[];
    };
    discussionSearch?: {
      discussionCount?: number;
      nodes?: DiscussionSearchNode[];
    };
  };
}

async function cmdSearchCombined(
  owner: string,
  repo: string,
  options: SearchOptions,
  limit: number,
  logger: Logger
): Promise<number> {
  const types = new Set<SearchType>(["issues", "discussions"]);
  const combinedQuery = buildCombinedGraphQLQuery(types);

  const variables: Record<string, string | number> = {
    first: Math.min(limit, 100),
  };

  let issueQuery = `repo:${owner}/${repo}`;
  if (options.query) issueQuery += ` ${options.query}`;
  if (options.state && options.state !== "all") {
    const validStates = ["open", "closed"];
    if (validStates.includes(options.state)) {
      issueQuery += ` is:${options.state}`;
    }
  }
  variables.issueQuery = issueQuery;

  let discussionQuery = `repo:${owner}/${repo} type:discussion`;
  if (options.query) discussionQuery += ` ${options.query}`;
  if (options.category) {
    discussionQuery += ` category:"${stripDoubleQuotes(options.category)}"`;
  }
  variables.discussionQuery = discussionQuery;

  const result = await runGraphQL<CombinedSearchResult>(combinedQuery, variables);

  if (!result.success) {
    logger.error("Search failed");
    return 1;
  }

  const data = result.data?.data;
  if (!data) {
    logger.error("Search failed: no data returned");
    return 1;
  }

  // issues 結果をパース
  const issueNodes = data.issueSearch?.nodes ?? [];
  const issues = issueNodes
    .filter((n): n is Required<Pick<IssueSearchNode, 'number'>> & IssueSearchNode => !!n?.number)
    .map((n) => ({
      number: n.number,
      title: n.title ?? "",
      url: n.url ?? "",
      state: n.state ?? "",
      is_pr: n.__typename === "PullRequest",
      author: n.author?.login ?? "",
      created_at: n.createdAt ?? "",
    }));

  // discussions 結果をパース
  const discussionNodes = data.discussionSearch?.nodes ?? [];
  const discussions = discussionNodes
    .filter((n): n is Required<Pick<DiscussionSearchNode, 'number'>> & DiscussionSearchNode => !!n?.number)
    .map((n) => ({
      number: n.number,
      title: n.title ?? "",
      url: n.url ?? "",
      category: n.category?.name ?? "",
      author: n.author?.login ?? "",
      answer_chosen: !!n.answerChosenAt,
      created_at: n.createdAt ?? "",
    }));

  const outputFormat = options.format ?? "table-json";

  if (outputFormat === "json") {
    const output = {
      repository: `${owner}/${repo}`,
      query: options.query ?? "",
      types: ["issues", "discussions"],
      results: {
        issues,
        issues_count: data.issueSearch?.issueCount ?? issues.length,
        discussions,
        discussions_count: data.discussionSearch?.discussionCount ?? discussions.length,
      },
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    // table-json: タイプ別にテーブル化
    const output: Record<string, unknown> = {
      repository: `${owner}/${repo}`,
      query: options.query ?? "",
      types: ["issues", "discussions"],
      issues: toTableJson(issues, GH_ISSUES_SEARCH_COLUMNS),
      issues_count: data.issueSearch?.issueCount ?? issues.length,
      discussions: toTableJson(discussions, GH_DISCUSSIONS_SEARCH_COLUMNS),
      discussions_count: data.discussionSearch?.discussionCount ?? discussions.length,
    };
    console.log(JSON.stringify(output, null, 2));
  }

  return 0;
}
