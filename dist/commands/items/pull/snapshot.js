/**
 * items pull - キャッシュ書き込みなしの API 取得（check コマンド用）(#1808)
 *
 * @related check/compare.ts - compareSnapshots（差分比較ロジック）
 */
import { runGraphQL } from "../../../utils/github.js";
import { GRAPHQL_QUERY_ISSUE_WITH_FIELDS, resolveIssueProjectFields, } from "./issue.js";
import { GRAPHQL_QUERY_DISCUSSION_WITH_FIELDS, } from "./discussion.js";
// =============================================================================
// キャッシュ書き込みなしの API 取得
// =============================================================================
/**
 * Issue または Discussion の API スナップショットをキャッシュ書き込みなしで取得する。
 *
 * `items check` が差分比較のためだけに使う関数。
 * `fetchAndCacheIssue` / `fetchAndCacheDiscussion` の GraphQL 呼び出しを再利用しつつ、
 * 一時ディレクトリへの書き込みを排除する。
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param number - アイテム番号
 * @param type - 種別（省略時は Issue → Discussion の順で自動判別）
 * @returns スナップショット、または取得失敗時は `null`。
 *   Discussion の場合、Projects フィールド（status/priority/size/labels）は含まれず `undefined` になる。
 */
export async function fetchRemoteSnapshot(owner, repo, number, type) {
    const graphqlVars = { owner, name: repo, number };
    if (type === "discussion") {
        // Discussion のみ取得
        const result = await runGraphQL(GRAPHQL_QUERY_DISCUSSION_WITH_FIELDS, graphqlVars);
        if (!result.success || !result.data?.data?.repository?.discussion) {
            return null;
        }
        const node = result.data.data.repository.discussion;
        return {
            number,
            type: "discussion",
            title: node.title ?? "",
            body: node.body ?? "",
            updated_at: node.updatedAt ?? "",
        };
    }
    if (type === "issue") {
        // Issue のみ取得
        return fetchRemoteIssueSnapshot(owner, repo, number, graphqlVars);
    }
    // 自動判別: Issue → Discussion の順で検索
    const issueSnapshot = await fetchRemoteIssueSnapshot(owner, repo, number, graphqlVars);
    if (issueSnapshot)
        return issueSnapshot;
    const discResult = await runGraphQL(GRAPHQL_QUERY_DISCUSSION_WITH_FIELDS, graphqlVars);
    if (!discResult.success || !discResult.data?.data?.repository?.discussion) {
        return null;
    }
    const node = discResult.data.data.repository.discussion;
    return {
        number,
        type: "discussion",
        title: node.title ?? "",
        body: node.body ?? "",
        updated_at: node.updatedAt ?? "",
    };
}
/**
 * Issue のスナップショットをキャッシュ書き込みなしで取得する内部関数。
 */
async function fetchRemoteIssueSnapshot(owner, repo, number, graphqlVars) {
    const issueResult = await runGraphQL(GRAPHQL_QUERY_ISSUE_WITH_FIELDS, graphqlVars);
    if (!issueResult.success || !issueResult.data?.data?.repository?.issue) {
        return null;
    }
    const node = issueResult.data.data.repository.issue;
    // Projects フィールドを解決
    const { status, priority, size, labels, assignees } = await resolveIssueProjectFields(node, owner, repo);
    return {
        number,
        type: "issue",
        title: node.title ?? "",
        body: node.body ?? "",
        updated_at: node.updatedAt ?? "",
        status,
        priority,
        size,
        labels: labels.length > 0 ? labels : undefined,
        assignees: assignees.length > 0 ? assignees : undefined,
    };
}
//# sourceMappingURL=snapshot.js.map