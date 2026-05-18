import type { Logger } from "../../utils/logger.js";
import { runGraphQL } from "../../utils/github.js";
import { formatOutput } from "../../utils/formatters.js";
import { writeToFile } from "../../utils/cli-helpers.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import {
  GRAPHQL_QUERY_DISCUSSION,
  GRAPHQL_QUERY_DISCUSSION_BY_ID,
  type DiscussionsOptions,
} from "./helpers.js";
import { writeCache, writeCommentCache } from "../../utils/github-cache.js";

// =============================================================================
// GraphQL Queries
// =============================================================================

// Discussion コメント取得クエリ（withComments: true のとき並列実行 #1751, #1752）
// ベースクエリとは別に定義し、フィールド同期の手動管理を排除する
const GRAPHQL_QUERY_DISCUSSION_COMMENTS = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
      comments(first: 100) {
        totalCount
        nodes {
          id
          databaseId
          author { login }
          body
          createdAt
          url
          isAnswer
          replies(first: 20) {
            totalCount
            nodes {
              id
              databaseId
              author { login }
              body
              createdAt
              url
            }
          }
        }
      }
    }
  }
}
`;

/**
 * `withComments: true` のとき（show コマンド経由）Discussion コメント全件を追加取得して出力に含める。
 * `writeCache: true` のとき（show コマンド経由）取得データをキャッシュに書き込む (#1768)。
 * `discussions show` 直接呼び出しでは `withComments` / `writeCache` が渡されないため既存動作を維持する。
 */
export async function cmdGet(
  idOrNumber: string,
  options: DiscussionsOptions & { withComments?: boolean; writeCache?: boolean },
  logger: Logger
): Promise<number> {
  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;

  interface CommentReplyNode {
    id?: string;
    databaseId?: number;
    author?: { login?: string };
    body?: string;
    createdAt?: string;
    url?: string;
  }

  interface CommentNode {
    id?: string;
    databaseId?: number;
    author?: { login?: string };
    body?: string;
    createdAt?: string;
    url?: string;
    isAnswer?: boolean;
    replies?: { totalCount?: number; nodes?: CommentReplyNode[] };
  }

  interface DiscussionNode {
    id?: string;
    number?: number;
    title?: string;
    body?: string;
    url?: string;
    createdAt?: string;
    updatedAt?: string;
    answerChosenAt?: string;
    author?: { login?: string };
    category?: { name?: string };
  }

  interface CommentsQueryResult {
    data?: {
      repository?: {
        discussion?: {
          comments?: {
            totalCount?: number;
            nodes?: CommentNode[];
          };
        };
      };
    };
  }

  let discussion: DiscussionNode | null = null;
  let commentsData: { totalCount?: number; nodes?: CommentNode[] } | null = null;

  if (/^\d+$/.test(idOrNumber)) {
    const number = parseInt(idOrNumber, 10);

    interface QueryResult {
      data?: {
        repository?: {
          discussion?: DiscussionNode;
        };
      };
    }

    // withComments: true のとき、ベースクエリとコメントクエリを並列実行 (#1751, #1752)
    const graphqlVars = { owner, name: repo, number };
    const [result, commentsResult] = await Promise.all([
      runGraphQL<QueryResult>(GRAPHQL_QUERY_DISCUSSION, graphqlVars),
      options.withComments
        ? runGraphQL<CommentsQueryResult>(GRAPHQL_QUERY_DISCUSSION_COMMENTS, graphqlVars)
        : Promise.resolve(null),
    ]);

    if (result.success && result.data?.data?.repository?.discussion) {
      discussion = result.data.data.repository.discussion;
    }

    if (commentsResult?.success) {
      commentsData = commentsResult.data?.data?.repository?.discussion?.comments ?? null;
    }
  } else {
    interface QueryResult {
      data?: {
        node?: DiscussionNode;
      };
    }

    const result = await runGraphQL<QueryResult>(GRAPHQL_QUERY_DISCUSSION_BY_ID, {
      id: idOrNumber,
    });

    if (result.success && result.data?.data?.node) {
      discussion = result.data.data.node;
    }

    // ID 指定パスでも withComments: true のときコメントを取得する (#1752)
    if (options.withComments && discussion?.number) {
      const commentsResult = await runGraphQL<CommentsQueryResult>(
        GRAPHQL_QUERY_DISCUSSION_COMMENTS,
        { owner, name: repo, number: discussion.number }
      );
      if (commentsResult.success) {
        commentsData = commentsResult.data?.data?.repository?.discussion?.comments ?? null;
      }
    }
  }

  if (!discussion || !discussion.id) {
    logger.error(`Discussion '${idOrNumber}' not found`);
    return 1;
  }

  const output: Record<string, unknown> = {
    id: discussion.id,
    number: discussion.number,
    title: discussion.title,
    body: discussion.body,
    created_at: discussion.createdAt,
    updated_at: discussion.updatedAt,
    author: discussion.author?.login,
    category: discussion.category?.name,
    answer_chosen: !!discussion.answerChosenAt,
  };

  // withComments: true のとき（show コマンド経由）コメントフィールドを出力に追加する (#1751)
  if (options.withComments && commentsData) {
    const nodes = commentsData.nodes ?? [];
    output.comments = nodes.map((c) => ({
      id: c.id,
      database_id: c.databaseId,
      author: c.author?.login ?? null,
      body: c.body,
      created_at: c.createdAt,
      url: c.url,
      is_answer: c.isAnswer ?? false,
      replies: (c.replies?.nodes ?? []).map((r) => ({
        id: r.id,
        database_id: r.databaseId,
        author: r.author?.login ?? null,
        body: r.body,
        created_at: r.createdAt,
        url: r.url,
      })),
    }));
    output.total_comments = commentsData.totalCount ?? 0;

    // コメント上限警告 (#1752)
    const totalCount = commentsData.totalCount ?? 0;
    if (nodes.length < totalCount) {
      logger.warn(`Discussion #${discussion.number}: comments ${nodes.length}/${totalCount} 件取得（上限超過）`);
    }
    // 返信の上限警告
    for (const c of nodes) {
      const repliesTotal = c.replies?.totalCount ?? 0;
      const repliesCount = c.replies?.nodes?.length ?? 0;
      if (repliesCount < repliesTotal) {
        logger.warn(`Discussion #${discussion.number} comment: replies ${repliesCount}/${repliesTotal} 件取得（上限超過）`);
        break; // 1 件だけ警告すれば十分
      }
    }
  }

  // キャッシュ書き込み: show コマンド経由のシングルリポジトリ参照時のみ (#1768)
  if (options.writeCache && discussion.number) {
    const discussionNumber = discussion.number;
    writeCache(
      discussionNumber,
      {
        number: discussionNumber,
        type: "discussion",
        title: discussion.title,
        updated_at: discussion.updatedAt,
      },
      typeof discussion.body === "string" ? discussion.body : "",
      owner,
      repo
    );

    // コメントも個別にキャッシュ書き込み
    if (commentsData) {
      const nodes = commentsData.nodes ?? [];
      for (const c of nodes) {
        if (c.databaseId) {
          writeCommentCache(
            discussionNumber,
            c.databaseId,
            { number: discussionNumber, database_id: c.databaseId },
            typeof c.body === "string" ? c.body : "",
            "discussion",
            owner,
            repo
          );

          // 返信もキャッシュ書き込み
          const replies = c.replies?.nodes ?? [];
          for (const r of replies) {
            if (r.databaseId) {
              writeCommentCache(
                discussionNumber,
                r.databaseId,
                {
                  number: discussionNumber,
                  database_id: r.databaseId,
                  reply_to: c.databaseId,
                },
                typeof r.body === "string" ? r.body : "",
                "discussion",
                owner,
                repo
              );
            }
          }
        }
      }
    }
  }

  // --to-file: ファイルに frontmatter 形式で書き出し (#1337)
  const toFileResult = await writeToFile(output, options.toFile);
  if (toFileResult !== null) return toFileResult;

  const outputFormat = options.format ?? "frontmatter";
  console.log(formatOutput(output, outputFormat));
  return 0;
}

// エクスポートエイリアス: show コマンドからの委任用 (#1138)
export { cmdGet as cmdDiscussionShow };
