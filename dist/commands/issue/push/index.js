/**
 * items push サブコマンド (#1808)
 *
 * ローカルキャッシュファイルと GitHub のリモート状態を比較し、差分を検出してアップロードする。
 *
 * 対応する更新対象:
 * - Issue 本文（GraphQL updateIssue mutation）
 * - Issue title（GraphQL updateIssue mutation）
 * - Issue ラベル（frontmatter labels フィールドの差分を add/remove）
 * - Issue 担当者（frontmatter assignees フィールドの差分を add/remove）
 * - Discussion 本文（GraphQL updateDiscussion mutation）
 * - Discussion title（GraphQL updateDiscussion mutation）
 * - Projects フィールド（Status/Priority/Size）
 * - コメント本文（REST API PATCH / GraphQL updateDiscussionComment）
 *
 * ステータス遷移バリデーション:
 * - 通常あり得ない遷移は警告で停止する
 * - `--force` で強制実行
 */
import { isIssueNumber, parseIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { probeReadCache } from "../../../utils/github-cache.js";
import { pushIssueBody } from "./issue.js";
import { pushDiscussionBody } from "./discussion.js";
import { pushComment } from "./comment.js";
// =============================================================================
// コマンドエントリポイント
// =============================================================================
/**
 * items push サブコマンド
 *
 * 引数:
 * - `numberStr`: アイテム番号
 * - `commentId`: コメント databaseId（省略時は本体を push）
 */
export async function cmdPush(numberStr, commentIdStr, options, logger) {
    // #2024 Phase 4: 非推奨警告
    logger.warn("⚠ 'items push' は非推奨です。代わりに 'items update' または 'items transition' を使用してください。");
    if (!isIssueNumber(numberStr)) {
        logger.error("Valid item number required");
        return 1;
    }
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("Could not determine repository");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const number = parseIssueNumber(numberStr);
    // コメント push モード
    if (commentIdStr !== undefined) {
        return pushComment(owner, repo, number, commentIdStr, options, logger);
    }
    // 本体 push モード
    return pushBody(owner, repo, number, options, logger);
}
// =============================================================================
// 本体 push ディスパッチャ
// =============================================================================
async function pushBody(owner, repo, number, options, logger) {
    const cached = probeReadCache(number, owner, repo);
    if (!cached) {
        logger.error(`#${number} のキャッシュが見つかりません。先に items pull ${number} を実行してください`);
        return 1;
    }
    const { metadata, body } = cached;
    const type = metadata.type;
    if (type === "issue") {
        return pushIssueBody(owner, repo, number, body, metadata, options, logger);
    }
    else if (type === "discussion") {
        return pushDiscussionBody(owner, repo, number, body, metadata, options, logger);
    }
    else if (type === "pull_request") {
        logger.error(`PR の push はサポートされていません。PR のメタデータ変更は \`shirokuma-docs items pr edit\` を使用してください`);
        return 1;
    }
    else {
        logger.error(`サポートされていないアイテム種別: ${type}`);
        return 1;
    }
}
// =============================================================================
// Re-exports（後方互換維持）
// =============================================================================
export { pushIssueBody } from "./issue.js";
export { pushDiscussionBody } from "./discussion.js";
export { pushComment, pushIssueComment, pushDiscussionComment } from "./comment.js";
//# sourceMappingURL=index.js.map