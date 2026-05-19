/**
 * PR show subcommand - Show PR details
 *
 * Fetches and displays detailed information for a given PR number.
 */
import { runGraphQL, isIssueNumber, parseIssueNumber, } from "../../utils/github.js";
import { formatOutput } from "../../utils/formatters.js";
import { writeToFile } from "../../utils/cli-helpers.js";
import { resolveTargetRepo } from "../../utils/repo-pairs.js";
import { parseLinkedIssues } from "./helpers.js";
import { GRAPHQL_QUERY_PR_REVIEW_THREADS, transformReviews, transformThreads, transformIssueComments, } from "./comments.js";
// =============================================================================
// GraphQL Query
// =============================================================================
// PR 詳細取得クエリ（#568 — pr-show）
const GRAPHQL_QUERY_PR_SHOW = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number
      title
      state
      url
      body
      headRefName
      baseRefName
      author { login }
      reviewDecision
      reviewThreads(first: 0) { totalCount }
      reviews(first: 0) { totalCount }
      labels(first: 20) { nodes { name } }
      createdAt
      updatedAt
      additions
      deletions
      changedFiles
    }
  }
}
`;
// =============================================================================
// cmdPrShow (#568 — PR 詳細表示)
// =============================================================================
/**
 * `withComments: true` のとき（show コマンド経由）PR コメント・レビュースレッドを追加取得して出力に含める。
 * `pr show` 直接呼び出しでは `withComments` が渡されないため既存動作を維持する。
 */
export async function cmdPrShow(prNumberStr, options, logger) {
    if (!isIssueNumber(prNumberStr)) {
        logger.error(`Invalid PR number: ${prNumberStr}`);
        return 1;
    }
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("Could not determine repository");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const prNumber = parseIssueNumber(prNumberStr);
    // detail と comments を並列取得（withComments: true のとき）で 1 ラウンドトリップ削減
    const graphqlVars = { owner, name: repo, number: prNumber };
    const [result, commentsResult] = await Promise.all([
        runGraphQL(GRAPHQL_QUERY_PR_SHOW, graphqlVars),
        options.withComments
            ? runGraphQL(GRAPHQL_QUERY_PR_REVIEW_THREADS, graphqlVars)
            : Promise.resolve(null),
    ]);
    if (!result.success || !result.data?.data?.repository?.pullRequest) {
        logger.error(`PR #${prNumber} not found`);
        return 1;
    }
    const pr = result.data.data.repository.pullRequest;
    const body = pr.body ?? "";
    const output = {
        number: pr.number ?? 0,
        title: pr.title ?? "",
        state: pr.state ?? "OPEN",
        head_branch: pr.headRefName ?? "",
        base_branch: pr.baseRefName ?? "",
        author: pr.author?.login ?? "",
        review_decision: pr.reviewDecision ?? null,
        url: pr.url ?? "",
        body,
        labels: (pr.labels?.nodes ?? []).map((l) => l?.name ?? "").filter(Boolean),
        created_at: pr.createdAt ?? "",
        updated_at: pr.updatedAt ?? "",
        additions: pr.additions ?? 0,
        deletions: pr.deletions ?? 0,
        changed_files: pr.changedFiles ?? 0,
        review_thread_count: pr.reviewThreads?.totalCount ?? 0,
        review_count: pr.reviews?.totalCount ?? 0,
        linked_issues: parseLinkedIssues(body),
    };
    // withComments: true のとき（show コマンド経由）PR コメント・レビュースレッドを出力に含める (#1751)
    if (commentsResult?.success && commentsResult.data?.data?.repository?.pullRequest) {
        const prComments = commentsResult.data.data.repository.pullRequest;
        const reviewNodes = prComments.reviews?.nodes ?? [];
        const threadNodes = prComments.reviewThreads?.nodes ?? [];
        const commentNodes = prComments.comments?.nodes ?? [];
        output.reviews = transformReviews(reviewNodes);
        output.threads = transformThreads(threadNodes);
        output.unresolved_threads = output.threads.filter((t) => !t.is_resolved).length;
        output.issue_comments = transformIssueComments(commentNodes);
        // コメント上限警告 (#1752)
        const reviewsTotal = prComments.reviews?.totalCount ?? 0;
        const threadsTotal = prComments.reviewThreads?.totalCount ?? 0;
        const commentsTotal = prComments.comments?.totalCount ?? 0;
        if (reviewNodes.length < reviewsTotal) {
            logger.warn(`PR #${prNumber}: reviews ${reviewNodes.length}/${reviewsTotal} 件取得（上限超過）`);
        }
        if (threadNodes.length < threadsTotal) {
            logger.warn(`PR #${prNumber}: review threads ${threadNodes.length}/${threadsTotal} 件取得（上限超過）`);
        }
        if (commentNodes.length < commentsTotal) {
            logger.warn(`PR #${prNumber}: comments ${commentNodes.length}/${commentsTotal} 件取得（上限超過）`);
        }
    }
    // --to-file: ファイルに frontmatter 形式で書き出し (#1337)
    const toFileResult = await writeToFile(output, options.toFile);
    if (toFileResult !== null)
        return toFileResult;
    const outputFormat = options.format ?? "frontmatter";
    console.log(formatOutput(output, outputFormat));
    return 0;
}
//# sourceMappingURL=show.js.map