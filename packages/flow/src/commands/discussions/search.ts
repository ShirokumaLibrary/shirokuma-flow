import type { Logger } from "../../utils/logger.js";
import { runGraphQL } from "../../utils/github.js";
import {
  formatOutput,
  GH_DISCUSSIONS_LIST_COLUMNS,
} from "../../utils/formatters.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import { stripDoubleQuotes } from "../../utils/sanitize.js";
import {
  GRAPHQL_QUERY_SEARCH_DISCUSSIONS,
  type DiscussionsOptions,
  type Discussion,
} from "./helpers.js";

export async function cmdSearch(
  options: DiscussionsOptions,
  logger: Logger
): Promise<number> {
  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;

  let searchQuery = `repo:${owner}/${repo} type:discussion`;

  if (options.query) {
    searchQuery += ` ${options.query}`;
  }

  if (options.category) {
    searchQuery += ` category:"${stripDoubleQuotes(options.category)}"`;
  }

  const limit = options.limit ?? 20;

  interface SearchNode {
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

  interface SearchResult {
    data?: {
      search?: {
        discussionCount?: number;
        nodes?: SearchNode[];
      };
    };
  }

  const result = await runGraphQL<SearchResult>(GRAPHQL_QUERY_SEARCH_DISCUSSIONS, {
    searchQuery,
    first: Math.min(limit, 100),
  });

  if (!result.success || !result.data?.data?.search) {
    logger.error("Search failed");
    return 1;
  }

  const searchData = result.data.data.search;
  const nodes = searchData.nodes ?? [];

  const discussions: Discussion[] = nodes
    .filter((n): n is Required<Pick<SearchNode, 'id' | 'number'>> & SearchNode => !!n?.id && !!n?.number)
    .map((n) => ({
      id: n.id,
      number: n.number,
      title: n.title ?? "",
      url: n.url ?? "",
      createdAt: n.createdAt ?? "",
      updatedAt: n.updatedAt ?? "",
      author: n.author?.login ?? "",
      category: n.category?.name ?? "",
      answerChosenAt: n.answerChosenAt ?? undefined,
    }));

  const output = {
    repository: `${owner}/${repo}`,
    query: options.query ?? "",
    category: options.category ?? null,
    discussions: discussions.map((d) => ({
      id: d.id,
      number: d.number,
      title: d.title,
      url: d.url,
      created_at: d.createdAt,
      updated_at: d.updatedAt,
      author: d.author,
      category: d.category,
      answer_chosen: !!d.answerChosenAt,
    })),
    total_count: searchData.discussionCount ?? discussions.length,
  };

  const outputFormat = options.format ?? "table-json";
  const formatted = formatOutput(output, outputFormat, {
    arrayKey: "discussions",
    columns: GH_DISCUSSIONS_LIST_COLUMNS,
  });
  console.log(formatted);
  return 0;
}
