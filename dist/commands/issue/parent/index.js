/**
 * items parent/unparent - Sub-Issue 親子関係管理ロジック (#1810)
 *
 * issues sub-add/sub-remove ロジックを items サブコマンドとして提供する。
 */
import { runGraphQL, parseIssueNumber, isIssueNumber } from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { getOctokit } from "../../../utils/octokit-client.js";
import { getIssueInternalId, resolveIssueTypeId } from "../../items/helpers.js";
import { GRAPHQL_MUTATION_UPDATE_ISSUE } from "../push/issue.js";
// =============================================================================
// Commands
// =============================================================================
/**
 * items parent <number> <parent-number> - Issue を親 Issue のサブ Issue に設定する。
 */
export async function cmdItemParent(issueNumberStr, parentNumberStr, options, logger) {
    if (!isIssueNumber(issueNumberStr)) {
        logger.error(`無効な Issue 番号です: ${issueNumberStr}`);
        return 1;
    }
    if (!isIssueNumber(parentNumberStr)) {
        logger.error(`無効な親 Issue 番号です: ${parentNumberStr}`);
        return 1;
    }
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("リポジトリを特定できません");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const issueNumber = parseIssueNumber(issueNumberStr);
    const parentNumber = parseIssueNumber(parentNumberStr);
    // 子 Issue の内部 ID を取得
    const childInternalId = await getIssueInternalId(owner, repo, issueNumber);
    if (!childInternalId) {
        logger.error(`Issue #${issueNumber} の内部 ID が取得できません`);
        return 1;
    }
    try {
        const octokit = getOctokit();
        await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues", {
            owner,
            repo,
            issue_number: parentNumber,
            sub_issue_id: childInternalId,
            ...(options.replaceParent ? { replace_parent_issue: true } : {}),
        });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("422") || message.includes("already has a parent") || message.includes("sub_issue_id")) {
            logger.error(`Issue #${issueNumber} は既に親 Issue に紐付けられています。` +
                ` --replace-parent で上書きできます。`);
        }
        else {
            logger.error(`親 Issue の設定に失敗しました: ${message}`);
        }
        return 1;
    }
    logger.success(`Issue #${issueNumber} を #${parentNumber} のサブ Issue に設定しました`);
    // 親子関係設定成功後、子 Issue のフィールドを自動更新 (#1931)
    // 自動更新の失敗は親子関係設定の成功に影響させない
    let autoUpdates = [];
    try {
        autoUpdates = await autoSetChildFields(owner, repo, issueNumber, logger);
    }
    catch (e) {
        logger.warn(`子 Issue のフィールド自動更新に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
    console.log(JSON.stringify({
        child: issueNumber,
        parent: parentNumber,
        action: "parented",
        ...(autoUpdates.length > 0 ? { autoUpdated: autoUpdates } : {}),
    }, null, 2));
    return 0;
}
// =============================================================================
// autoSetChildFields - 子 Issue の Status / IssueType を自動更新
// =============================================================================
// NOTE: projectItems(first: 5) は最初の Project Item の Status のみ参照する。
// 1リポ=1 Project 前提のため、先頭の項目で十分。
const GRAPHQL_QUERY_CHILD_FIELDS = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id
      issueType { name }
      projectItems(first: 5) {
        nodes {
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
        }
      }
    }
  }
}
`;
/**
 * 子 Issue の Status (Backlog → Ready) と IssueType (未設定 → Task) を自動設定する。
 * 変更があった場合はログに出力し、変更内容の配列を返す。
 * @internal
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param issueNumber - 子 Issue 番号
 * @param logger - Logger インスタンス
 * @returns 変更内容の文字列配列（例: ["IssueType → Task", "Status → Ready"]）
 */
async function autoSetChildFields(owner, repo, issueNumber, logger) {
    const autoUpdates = [];
    const result = await runGraphQL(GRAPHQL_QUERY_CHILD_FIELDS, {
        owner,
        name: repo,
        number: issueNumber,
    });
    if (!result.success)
        return autoUpdates;
    const issue = result.data.data?.repository?.issue;
    if (!issue?.id)
        return autoUpdates;
    // IssueType が未設定 → Task に自動設定
    if (!issue.issueType) {
        const taskTypeId = await resolveIssueTypeId(owner, "Task", logger);
        if (typeof taskTypeId === "string") {
            const updateResult = await runGraphQL(GRAPHQL_MUTATION_UPDATE_ISSUE, {
                id: issue.id,
                issueTypeId: taskTypeId,
            });
            if (updateResult.success) {
                autoUpdates.push("IssueType → Task");
                logger.success(`Issue #${issueNumber}: IssueType を Task に設定しました`);
            }
        }
    }
    // Backlog → Ready 自動遷移は廃止（#2202: Ready を Backlog に統合）
    // 親子関係設定後、子 Issue は Backlog のまま維持する
    return autoUpdates;
}
/**
 * items unparent <number> - Issue の親 Issue の紐付けを解除する。
 */
export async function cmdItemUnparent(issueNumberStr, options, logger) {
    if (!isIssueNumber(issueNumberStr)) {
        logger.error(`無効な Issue 番号です: ${issueNumberStr}`);
        return 1;
    }
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("リポジトリを特定できません");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const issueNumber = parseIssueNumber(issueNumberStr);
    // 子 Issue の内部 ID を取得
    const childInternalId = await getIssueInternalId(owner, repo, issueNumber);
    if (!childInternalId) {
        logger.error(`Issue #${issueNumber} の内部 ID が取得できません`);
        return 1;
    }
    // GraphQL で親 Issue 番号を取得（Sub-Issues API の parent フィールドを利用）
    let parentNumber;
    try {
        const QUERY_PARENT = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      parent { number }
    }
  }
}
`;
        const parentResult = await runGraphQL(QUERY_PARENT, {
            owner,
            name: repo,
            number: issueNumber,
        });
        if (parentResult.success) {
            parentNumber = parentResult.data.data?.repository?.issue?.parent?.number;
        }
    }
    catch {
        // GraphQL parent query failed — treated as no parent found
    }
    if (parentNumber === undefined) {
        logger.error(`Issue #${issueNumber} の親 Issue が見つかりません`);
        return 1;
    }
    try {
        const octokit = getOctokit();
        await octokit.request("DELETE /repos/{owner}/{repo}/issues/{issue_number}/sub_issue", {
            owner,
            repo,
            issue_number: parentNumber,
            sub_issue_id: childInternalId,
        });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error(`親 Issue の解除に失敗しました: ${message}`);
        return 1;
    }
    logger.success(`Issue #${issueNumber} の親 Issue (#${parentNumber}) 紐付けを解除しました`);
    console.log(JSON.stringify({
        child: issueNumber,
        parent: parentNumber,
        action: "unparented",
    }, null, 2));
    return 0;
}
//# sourceMappingURL=index.js.map