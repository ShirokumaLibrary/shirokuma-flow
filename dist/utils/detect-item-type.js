/**
 * detect-item-type - 番号から Issue/PR/Discussion の種別を判別する共有ユーティリティ
 *
 * GraphQL の issueOrPullRequest で Issue/PR を __typename で判別し、
 * Discussion は別番号空間として同一クエリまたはフォールバックで取得する。
 * `show` コマンドと `comment` コマンドで共有。
 */
import { runGraphQL, isIssueNumber, parseIssueNumber, } from "./github.js";
import { resolveTargetRepo, validateCrossRepoAlias, } from "./repo-pairs.js";
// =============================================================================
// GraphQL
// =============================================================================
/** issueOrPullRequest の共通フラグメント */
const ISSUE_OR_PR_FRAGMENT = `
    issueOrPullRequest(number: $number) {
      __typename
      ... on Issue {
        number
        title
      }
      ... on PullRequest {
        number
        title
      }
    }`;
/**
 * issueOrPullRequest + discussion の 2 フィールドクエリ。
 * issueOrPullRequest は union 型で Issue/PR を __typename で判別し、
 * 存在しない番号では null を返す（エラーにならない）。
 */
export const GRAPHQL_QUERY_DETECT_TYPE = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
${ISSUE_OR_PR_FRAGMENT}
    discussion(number: $number) {
      number
      title
    }
  }
}
`;
/**
 * issueOrPullRequest のみのフォールバッククエリ。
 * メインクエリが discussion フィールドのエラーで失敗した場合に使用。
 */
export const GRAPHQL_QUERY_ISSUE_OR_PR_ONLY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
${ISSUE_OR_PR_FRAGMENT}
  }
}
`;
// =============================================================================
// Detection logic (pure, exported for testing)
// =============================================================================
/**
 * GraphQL レスポンスから種別を判別する。
 * issueOrPullRequest の __typename で Issue/PR を判別し、Discussion は別番号空間として扱う。
 *
 * - issueOrPullRequest が存在 → __typename で "Issue" / "PullRequest" を判別
 * - Discussion は別番号空間のため、Issue/PR がある場合はそちらを優先
 * - DetectResult.type は短縮形（"pr"）を使用
 */
export function detectItemType(input) {
    const { issueOrPullRequest, discussion } = input;
    const hasIoP = issueOrPullRequest != null;
    const hasDiscussion = discussion != null;
    if (!hasIoP && !hasDiscussion) {
        return null;
    }
    if (hasIoP) {
        const type = issueOrPullRequest.__typename === "PullRequest" ? "pr" : "issue";
        const result = { type, data: issueOrPullRequest };
        if (hasDiscussion) {
            result.ambiguous = { type: "discussion", data: discussion };
        }
        return result;
    }
    // Discussion のみ
    return { type: "discussion", data: discussion };
}
/**
 * 番号文字列を検証し、GraphQL で種別を判別して DetectResult を返す。
 * エラー時は logger にメッセージを出力し null を返す。
 */
export async function detectAndResolve(numberStr, options, logger) {
    // --repo alias 検証
    if (options.repo) {
        const aliasError = validateCrossRepoAlias(options.repo);
        if (aliasError) {
            logger.error(aliasError);
            return null;
        }
    }
    if (!isIssueNumber(numberStr)) {
        logger.error(`Invalid number: ${numberStr}`);
        return null;
    }
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("Could not determine repository");
        return null;
    }
    const { owner, name: repo } = repoInfo;
    const number = parseIssueNumber(numberStr);
    // issueOrPullRequest + discussion の 2 フィールドクエリ
    const result = await runGraphQL(GRAPHQL_QUERY_DETECT_TYPE, {
        owner,
        name: repo,
        number,
    }, { silent: true });
    let detected = null;
    if (result.success) {
        const repoData = result.data?.data?.repository;
        detected = detectItemType({
            issueOrPullRequest: repoData?.issueOrPullRequest ?? null,
            discussion: repoData?.discussion ?? null,
        });
    }
    else {
        // discussion フィールドのエラーで全体失敗した場合、issueOrPullRequest のみで再試行
        const fallback = await runGraphQL(GRAPHQL_QUERY_ISSUE_OR_PR_ONLY, {
            owner,
            name: repo,
            number,
        }, { silent: true });
        if (!fallback.success) {
            logger.error(`Failed to query #${number}: ${fallback.error}`);
            return null;
        }
        const repoData = fallback.data?.data?.repository;
        detected = detectItemType({
            issueOrPullRequest: repoData?.issueOrPullRequest ?? null,
            discussion: null,
        });
    }
    if (!detected) {
        logger.error(`#${number} not found (checked Issue, PR, Discussion)`);
        return null;
    }
    if (detected.ambiguous) {
        logger.debug(`Note: #${number} found as both ${detected.type} and ${detected.ambiguous.type}. Showing ${detected.type}.`);
    }
    return { number, detected };
}
/**
 * Helper to delegate command execution based on detected item type.
 * Handles exit code and error handling uniformly across all top-level commands.
 *
 * @example
 * const { number, detected } = result;
 * await delegateToHandler(number, detected, {
 *   issue: cmdIssueShow,
 *   pr: cmdPrShow,
 *   discussion: cmdDiscussionShow,
 * }, delegateOptions, logger);
 */
export async function delegateToHandler(number, detected, handlers, options, logger) {
    switch (detected.type) {
        case "issue":
            return handlers.issue(String(number), options, logger);
        case "pr":
            return handlers.pr(String(number), options, logger);
        case "discussion":
            return handlers.discussion(String(number), options, logger);
    }
}
//# sourceMappingURL=detect-item-type.js.map