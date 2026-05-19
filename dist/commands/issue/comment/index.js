/**
 * items add comment - コメント追加ロジック (#1808)
 *
 * @related push/comment.ts - コメント push ロジック
 */
import { runGraphQL, validateBody } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { GRAPHQL_MUTATION_ADD_COMMENT, } from "../../../utils/graphql-queries.js";
import { GRAPHQL_MUTATION_ADD_DISCUSSION_COMMENT, getDiscussionId, } from "../../discussions/helpers.js";
import { getIssueId, getPullRequestId } from "../../items/helpers.js";
import { writeCommentCache } from "../../../utils/github-cache.js";
import { moveFile } from "../../../utils/file.js";
import { getCommentCachePath } from "../../../utils/github-cache.js";
import { readFileWithFrontmatter } from "../../items/add/shared.js";
import { isIssueNumber, parseIssueNumber } from "../../../utils/github.js";
// =============================================================================
// items add comment
// =============================================================================
/**
 * Issue / PR / Discussion にコメントを追加する。
 * アイテム種別は自動判別（Issue → PR → Discussion の順で試みる）。
 */
export async function cmdAddComment(numberStr, options, logger) {
    if (!isIssueNumber(numberStr)) {
        logger.error("Valid item number required");
        return 1;
    }
    if (!options.file) {
        logger.error("--file オプションは必須です");
        return 1;
    }
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("Could not determine repository");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const number = parseIssueNumber(numberStr);
    // ファイルを読み込む
    const fileData = readFileWithFrontmatter(options.file);
    if (!fileData) {
        logger.error(`ファイルが見つかりません: ${options.file}`);
        return 1;
    }
    const body = fileData.body;
    const bodyError = validateBody(body);
    if (bodyError) {
        logger.error(bodyError);
        return 1;
    }
    // Issue として試みる
    const issueId = await getIssueId(owner, repo, number);
    if (issueId) {
        return addIssueComment(owner, repo, number, issueId, body, options.file, "issue", logger);
    }
    // PR として試みる
    const prId = await getPullRequestId(owner, repo, number);
    if (prId) {
        return addIssueComment(owner, repo, number, prId, body, options.file, "pull_request", logger);
    }
    // Discussion として試みる
    const discussionId = await getDiscussionId(owner, repo, number);
    if (discussionId) {
        return addDiscussionComment(owner, repo, number, discussionId, body, options.file, logger);
    }
    logger.error(`#${number} は Issue でも PR でも Discussion でも見つかりませんでした`);
    return 1;
}
/** Issue / PR コメントを追加（GitHub GraphQL addComment mutation は Issue/PR 両方で動作する） */
async function addIssueComment(owner, repo, number, subjectId, body, filePath, itemType, logger) {
    const result = await runGraphQL(GRAPHQL_MUTATION_ADD_COMMENT, {
        subjectId,
        body,
    });
    if (!result.success) {
        logger.error("コメントの追加に失敗しました");
        return 1;
    }
    const comment = result.data?.data?.addComment?.commentEdge?.node;
    if (!comment?.databaseId) {
        logger.error("コメントの追加に失敗しました（ID を取得できません）");
        return 1;
    }
    // キャッシュに書き込む
    writeCommentCache(number, comment.databaseId, { number, database_id: comment.databaseId }, body, itemType, owner, repo);
    // ファイルをキャッシュディレクトリに移動
    const destPath = getCommentCachePath(number, comment.databaseId, itemType, owner, repo);
    try {
        moveFile(filePath, destPath);
        logger.info(`ファイルをキャッシュに移動しました: ${destPath}`);
    }
    catch {
        logger.warn(`ファイルの移動に失敗しました（キャッシュは書き込み済み）`);
    }
    const label = itemType === "pull_request" ? "PR" : "Issue";
    logger.success(`${label} #${number} にコメントを追加しました`);
    console.log(JSON.stringify({
        number,
        type: itemType,
        comment_database_id: comment.databaseId,
        comment_id: comment.id,
        url: comment.url,
        comment_url: comment.url, // url と同じ値。後方互換用（廃止予定）
        cache_file: destPath,
    }, null, 2));
    return 0;
}
/** Discussion コメントを追加 */
async function addDiscussionComment(owner, repo, number, discussionId, body, filePath, logger) {
    const result = await runGraphQL(GRAPHQL_MUTATION_ADD_DISCUSSION_COMMENT, {
        discussionId,
        body,
    });
    if (!result.success) {
        logger.error("コメントの追加に失敗しました");
        return 1;
    }
    const comment = result.data?.data?.addDiscussionComment?.comment;
    if (!comment?.id || !comment?.databaseId) {
        logger.error("コメントの追加に失敗しました（ID を取得できません）");
        return 1;
    }
    // キャッシュに書き込む
    writeCommentCache(number, comment.databaseId, { number, database_id: comment.databaseId }, body, "discussion", owner, repo);
    // ファイルをキャッシュディレクトリに移動
    const destPath = getCommentCachePath(number, comment.databaseId, "discussion", owner, repo);
    try {
        moveFile(filePath, destPath);
        logger.info(`ファイルをキャッシュに移動しました: ${destPath}`);
    }
    catch {
        logger.warn(`ファイルの移動に失敗しました（キャッシュは書き込み済み）`);
    }
    logger.success(`Discussion #${number} にコメントを追加しました`);
    console.log(JSON.stringify({
        number,
        type: "discussion",
        comment_database_id: comment.databaseId,
        comment_id: comment.id,
        url: comment.url,
        comment_url: comment.url, // url と同じ値。後方互換用（廃止予定）
        cache_file: destPath,
    }, null, 2));
    return 0;
}
//# sourceMappingURL=index.js.map