/**
 * search command - Issues + Discussions 横断検索
 *
 * GraphQL エイリアスで search(type: ISSUE) と search(type: DISCUSSION) を
 * 1 リクエストに束ね、LLM のコンテキスト効率を最大化する。
 *
 * @see Issue #553
 */
import { createLogger } from "../utils/logger.js";
import { runGraphQL } from "../utils/github.js";
import { resolveTargetRepo } from "../utils/repo-pairs.js";
import { toTableJson, GH_ISSUES_SEARCH_COLUMNS, GH_DISCUSSIONS_SEARCH_COLUMNS, } from "../utils/formatters.js";
import { stripDoubleQuotes } from "../utils/sanitize.js";
/** 有効な検索タイプ */
const VALID_TYPES = ["issues", "discussions"];
// ---------------------------------------------------------------------------
// GraphQL クエリビルダー
// ---------------------------------------------------------------------------
/**
 * --type に応じて GraphQL エイリアスクエリを構築する。
 * 指定されたタイプのみクエリに含め、不要なエイリアスを除外する。
 */
function buildGraphQLQuery(types) {
    const fragments = [];
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
          author { login }
        }
        ... on PullRequest {
          __typename
          number
          title
          url
          state
          createdAt
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
          author { login }
          category { name }
          answerChosenAt
        }
      }
    }`);
    }
    // 変数宣言を動的に構築
    const vars = ["$first: Int!"];
    if (types.has("issues"))
        vars.push("$issueQuery: String!");
    if (types.has("discussions"))
        vars.push("$discussionQuery: String!");
    return `query(${vars.join(", ")}) {${fragments.join("")}\n}`;
}
// ---------------------------------------------------------------------------
// メインコマンド
// ---------------------------------------------------------------------------
export async function searchCommand(query, options) {
    const logger = createLogger(options.verbose);
    if (!query) {
        logger.error("Search query is required");
        return 1;
    }
    // --type パース
    const requestedTypes = parseTypes(options.type, logger);
    if (!requestedTypes)
        return 1;
    // --category バリデーション: issues のみの場合は警告
    if (options.category && !requestedTypes.has("discussions")) {
        logger.warn("--category is only applicable to discussions search, ignoring");
    }
    // リポジトリ解決
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("Could not determine repository");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const limit = options.limit ?? 10;
    // 検索クエリ構築
    const variables = {
        first: Math.min(limit, 100),
    };
    if (requestedTypes.has("issues")) {
        let issueQuery = `repo:${owner}/${repo} ${query}`;
        if (options.state && options.state !== "all") {
            const validStates = ["open", "closed"];
            if (validStates.includes(options.state)) {
                issueQuery += ` is:${options.state}`;
            }
        }
        variables.issueQuery = issueQuery;
    }
    if (requestedTypes.has("discussions")) {
        let discussionQuery = `repo:${owner}/${repo} type:discussion ${query}`;
        if (options.category) {
            discussionQuery += ` category:"${stripDoubleQuotes(options.category)}"`;
        }
        variables.discussionQuery = discussionQuery;
    }
    // GraphQL 実行
    const graphqlQuery = buildGraphQLQuery(requestedTypes);
    const result = await runGraphQL(graphqlQuery, variables);
    if (!result.success) {
        logger.error("Search failed");
        return 1;
    }
    const data = result.data?.data;
    if (!data) {
        logger.error("Search failed: no data returned");
        return 1;
    }
    // 結果構築
    const output = buildOutput(data, requestedTypes, query, options, owner, repo);
    // 出力フォーマット
    const outputFormat = options.format ?? "table-json";
    const formatted = formatSearchOutput(output, outputFormat, requestedTypes);
    console.log(formatted);
    return 0;
}
// ---------------------------------------------------------------------------
// ヘルパー関数
// ---------------------------------------------------------------------------
/**
 * --type オプションをパースし、検索対象の Set を返す。
 * 不正な値が含まれる場合はエラーを出して null を返す。
 */
function parseTypes(typeOption, logger) {
    if (!typeOption) {
        return new Set(["issues", "discussions"]);
    }
    const parts = typeOption.split(",").map((t) => t.trim().toLowerCase());
    const types = new Set();
    for (const part of parts) {
        if (!VALID_TYPES.includes(part)) {
            logger.error(`Invalid search type: "${part}". Valid types: ${VALID_TYPES.join(", ")}`);
            return null;
        }
        types.add(part);
    }
    if (types.size === 0) {
        logger.error("At least one search type is required");
        return null;
    }
    return types;
}
/** Issues の検索結果をパース */
function parseIssueResults(nodes) {
    return nodes
        .filter((n) => !!n?.number)
        .map((n) => ({
        number: n.number,
        title: n.title ?? "",
        url: n.url ?? "",
        state: n.state ?? "",
        is_pr: n.__typename === "PullRequest",
        author: n.author?.login ?? "",
        created_at: n.createdAt ?? "",
    }));
}
/** Discussions の検索結果をパース */
function parseDiscussionResults(nodes) {
    return nodes
        .filter((n) => !!n?.number)
        .map((n) => ({
        number: n.number,
        title: n.title ?? "",
        url: n.url ?? "",
        category: n.category?.name ?? "",
        author: n.author?.login ?? "",
        answer_chosen: !!n.answerChosenAt,
        created_at: n.createdAt ?? "",
    }));
}
/** 出力オブジェクトを構築 */
function buildOutput(data, types, query, options, owner, repo) {
    const output = {
        repository: `${owner}/${repo}`,
        query,
        types: Array.from(types),
    };
    if (options.state)
        output.state = options.state;
    if (options.category)
        output.category = options.category;
    const results = {};
    if (types.has("issues") && data.issueSearch) {
        const issues = parseIssueResults(data.issueSearch.nodes ?? []);
        results.issues = issues;
        results.issues_count = data.issueSearch.issueCount ?? issues.length;
    }
    if (types.has("discussions") && data.discussionSearch) {
        const discussions = parseDiscussionResults(data.discussionSearch.nodes ?? []);
        results.discussions = discussions;
        results.discussions_count =
            data.discussionSearch.discussionCount ?? discussions.length;
    }
    output.results = results;
    return output;
}
/**
 * 検索結果をフォーマットする。
 * table-json モードでは toTableJson をタイプごとに呼び出し、
 * グループ化構造を構築する（formatOutput は拡張しない）。
 */
function formatSearchOutput(data, format, types) {
    if (format === "json") {
        return JSON.stringify(data, null, 2);
    }
    // table-json: タイプ別にテーブル化
    const results = data.results;
    const output = {
        repository: data.repository,
        query: data.query,
        types: data.types,
    };
    if (data.state)
        output.state = data.state;
    if (data.category)
        output.category = data.category;
    if (types.has("issues") && results.issues) {
        const tableData = toTableJson(results.issues, GH_ISSUES_SEARCH_COLUMNS);
        output.issues = tableData;
        output.issues_count = results.issues_count;
    }
    if (types.has("discussions") && results.discussions) {
        const tableData = toTableJson(results.discussions, GH_DISCUSSIONS_SEARCH_COLUMNS);
        output.discussions = tableData;
        output.discussions_count = results.discussions_count;
    }
    return JSON.stringify(output, null, 2);
}
//# sourceMappingURL=search.js.map