import type { Logger } from "../../utils/logger.js";
import type { GhResult } from "../../utils/github.js";
import { loadGhConfig, getDefaultCategory, getDefaultLimit } from "../../utils/gh-config.js";
import {
  formatOutput,
  GH_DISCUSSIONS_LIST_COLUMNS,
} from "../../utils/formatters.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import {
  GRAPHQL_QUERY_DISCUSSIONS,
  getCategories,
  findCategory,
  type DiscussionsOptions,
  type Discussion,
} from "./helpers.js";
import { runGraphQL } from "../../utils/github.js";

export async function cmdList(
  options: DiscussionsOptions,
  logger: Logger
): Promise<number> {
  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;

  const config = loadGhConfig();
  const categoryName = options.category ?? getDefaultCategory(config);

  let categoryId: string | null = null;
  if (categoryName) {
    const category = await findCategory(owner, repo, categoryName);
    if (!category) {
      logger.error(`Category '${categoryName}' not found`);
      const categories = await getCategories(owner, repo);
      if (categories.length > 0) {
        logger.info(`Available categories: ${categories.map((c) => c.name).join(", ")}`);
      }
      return 1;
    }
    categoryId = category.id;
  }

  interface DiscussionNode {
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

  interface QueryResult {
    data?: {
      repository?: {
        discussions?: {
          pageInfo?: { hasNextPage?: boolean; endCursor?: string };
          nodes?: DiscussionNode[];
        };
      };
    };
  }

  const discussions: Discussion[] = [];
  let cursor: string | null = null;
  const limit = options.limit ?? getDefaultLimit(config);

  while (discussions.length < limit) {
    const fetchCount = Math.min(limit - discussions.length, 50);

    const result: GhResult<QueryResult> = await runGraphQL<QueryResult>(
      GRAPHQL_QUERY_DISCUSSIONS,
      {
        owner,
        name: repo,
        first: fetchCount,
        categoryId: categoryId,
        cursor: cursor,
      }
    );

    if (!result.success || !result.data?.data?.repository?.discussions) break;

    type DiscussionsData = NonNullable<NonNullable<NonNullable<QueryResult["data"]>["repository"]>["discussions"]>;
    const discussionsData: DiscussionsData = result.data.data.repository.discussions;
    const nodes: DiscussionNode[] = discussionsData.nodes ?? [];

    for (const node of nodes) {
      if (!node?.id || !node?.number) continue;

      discussions.push({
        id: node.id,
        number: node.number,
        title: node.title ?? "",
        url: node.url ?? "",
        createdAt: node.createdAt ?? "",
        updatedAt: node.updatedAt ?? "",
        author: node.author?.login ?? "",
        category: node.category?.name ?? "",
        answerChosenAt: node.answerChosenAt ?? undefined,
      });
    }

    const pageInfo = discussionsData.pageInfo ?? {};
    if (!pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor ?? null;
  }

  const output = {
    repository: `${owner}/${repo}`,
    category: categoryName ?? null,
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
    total_count: discussions.length,
  };

  const outputFormat = options.format ?? "table-json";
  const formatted = formatOutput(output, outputFormat, {
    arrayKey: "discussions",
    columns: GH_DISCUSSIONS_LIST_COLUMNS,
  });
  console.log(formatted);
  return 0;
}
