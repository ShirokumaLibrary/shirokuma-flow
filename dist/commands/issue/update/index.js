/**
 * items update サブコマンド (#2024 Phase 1-A)
 *
 * Issue / Discussion の本文・メタデータを1コマンドで更新する。
 * `items pull → 編集 → items push` の3ステップを置き換える。
 *
 * 対応フィールド:
 * - body (--body <file>): 本文をファイル内容で更新
 * - title (--title <title>): タイトルを更新
 * - status (--status <status>): ステータスを更新（transition バリデーション通過後）
 * - priority (--priority <priority>): Priority を更新
 * - size (--size <size>): Size を更新
 * - labels (--labels <labels>): ラベルを上書き設定
 * - add-label (--add-label <label>): ラベルを追加
 * - remove-label (--remove-label <label>): ラベルを削除
 * - assign (--assign <user>): 担当者を追加
 * - unassign (--unassign <user>): 担当者を削除
 * - comment (--comment <id> --body <file>): 既存コメントを更新
 */
import { readFileSync, existsSync } from "node:fs";
import { runGraphQL, parseIssueNumber, isIssueNumber } from "../../../utils/github.js";
import { getOctokit } from "../../../utils/octokit-client.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { validateStatusTransition } from "../../../utils/status-workflow.js";
import { resolveAndUpdateStatus, getIssueDetail } from "../../../utils/issue-detail.js";
import { stripFrontmatter } from "../../../utils/frontmatter-strip.js";
import { getProjectFields, setItemFields, } from "../../../utils/project-fields.js";
import { readContextCache, writeContextCache, } from "../../../utils/context-cache.js";
import { getLabels, normalizeLabels } from "../../items/helpers.js";
// =============================================================================
// GraphQL 定義
// =============================================================================
const GRAPHQL_MUTATION_UPDATE_ISSUE = `
mutation($id: ID!, $title: String, $body: String) {
  updateIssue(input: {id: $id, title: $title, body: $body}) {
    issue { id number title body updatedAt }
  }
}
`;
const GRAPHQL_MUTATION_UPDATE_DISCUSSION = `
mutation($id: ID!, $title: String, $body: String!) {
  updateDiscussion(input: {discussionId: $id, title: $title, body: $body}) {
    discussion { id number title body }
  }
}
`;
const GRAPHQL_MUTATION_UPDATE_COMMENT = `
mutation($id: ID!, $body: String!) {
  updateIssueComment(input: {id: $id, body: $body}) {
    issueComment { id body }
  }
}
`;
const GRAPHQL_MUTATION_ADD_LABELS = `
mutation($labelableId: ID!, $labelIds: [ID!]!) {
  addLabelsToLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {
    labelable { ... on Issue { id labels(first: 20) { nodes { name } } } }
  }
}
`;
const GRAPHQL_MUTATION_REMOVE_LABELS = `
mutation($labelableId: ID!, $labelIds: [ID!]!) {
  removeLabelsFromLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {
    labelable { ... on Issue { id labels(first: 20) { nodes { name } } } }
  }
}
`;
const GRAPHQL_MUTATION_SET_LABELS = `
mutation($labelableId: ID!, $labelIds: [ID!]!) {
  setLabelsToLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {
    labelable { ... on Issue { id labels(first: 20) { nodes { name } } } }
  }
}
`;
const GRAPHQL_MUTATION_ADD_ASSIGNEES = `
mutation($assignableId: ID!, $assigneeIds: [ID!]!) {
  addAssigneesToAssignable(input: {assignableId: $assignableId, assigneeIds: $assigneeIds}) {
    assignable { ... on Issue { id assignees(first: 10) { nodes { login } } } }
  }
}
`;
const GRAPHQL_MUTATION_REMOVE_ASSIGNEES = `
mutation($assignableId: ID!, $assigneeIds: [ID!]!) {
  removeAssigneesFromAssignable(input: {assignableId: $assignableId, assigneeIds: $assigneeIds}) {
    assignable { ... on Issue { id assignees(first: 10) { nodes { login } } } }
  }
}
`;
const GRAPHQL_QUERY_ITEM_FOR_UPDATE = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id
      title
      body
      state
      labels(first: 20) { nodes { id name } }
      assignees(first: 10) { nodes { id login } }
      projectItems(first: 5) {
        nodes {
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
        }
      }
    }
    discussion(number: $number) {
      id
      title
      body
    }
  }
}
`;
/** GitHub ユーザー ID を login から取得するクエリ */
const GRAPHQL_QUERY_USER_ID = `
query($login: String!) {
  user(login: $login) { id }
}
`;
// =============================================================================
// ヘルパー関数
// =============================================================================
/**
 * ファイルから本文を読み込む。
 * ファイルが存在しない場合はエラーを返す。
 */
function readBodyFromFile(filePath) {
    if (!existsSync(filePath)) {
        return { body: null, error: `ファイルが見つかりません: ${filePath}` };
    }
    try {
        const body = readFileSync(filePath, "utf-8");
        return { body, error: null };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { body: null, error: `ファイルの読み込みに失敗しました: ${msg}` };
    }
}
/**
 * @me を実際のログインに解決する。
 */
async function resolveLogin(login) {
    if (login !== "@me")
        return login;
    try {
        const octokit = getOctokit();
        const { data: authUser } = await octokit.rest.users.getAuthenticated();
        return authUser.login;
    }
    catch {
        return login;
    }
}
/**
 * ログイン名から GitHub ユーザー GraphQL ID を取得する。
 */
async function getUserId(login) {
    const result = await runGraphQL(GRAPHQL_QUERY_USER_ID, { login });
    if (!result.success)
        return null;
    return result.data?.data?.user?.id ?? null;
}
// =============================================================================
// コマンドエントリポイント
// =============================================================================
/**
 * items update サブコマンド
 *
 * Issue / Discussion のフィールドを複合更新する。
 */
export async function cmdItemUpdate(numberStr, options, logger) {
    if (!isIssueNumber(numberStr)) {
        logger.error("有効なアイテム番号を指定してください");
        return 1;
    }
    const repoInfo = resolveTargetRepo(options);
    if (!repoInfo) {
        logger.error("リポジトリを特定できません");
        return 1;
    }
    const { owner, name: repo } = repoInfo;
    const number = parseIssueNumber(numberStr);
    // オプションが1つも指定されていない場合はエラー
    const hasBodyUpdate = !!options.body;
    const hasCommentUpdate = !!options.comment && !!options.body;
    const hasMetaUpdate = !!(options.title || options.status || options.priority || options.size ||
        options.labels || options.addLabel || options.removeLabel ||
        options.assign || options.unassign);
    if (!hasBodyUpdate && !hasMetaUpdate && !hasCommentUpdate) {
        logger.error("更新するフィールドを少なくとも1つ指定してください");
        return 1;
    }
    // --comment --body でコメント更新
    if (options.comment && options.body) {
        return await updateComment(options.comment, options.body, number, logger);
    }
    // アイテム情報を取得
    const itemResult = await runGraphQL(GRAPHQL_QUERY_ITEM_FOR_UPDATE, { owner, name: repo, number });
    if (!itemResult.success) {
        logger.error(`#${number} の情報取得に失敗しました`);
        return 1;
    }
    const issueNode = itemResult.data?.data?.repository?.issue;
    const discussionNode = itemResult.data?.data?.repository?.discussion;
    // Discussion の場合は本文・タイトルのみ更新可能
    if (discussionNode?.id && !issueNode?.id) {
        return await updateDiscussion(discussionNode, number, options, logger);
    }
    if (!issueNode?.id) {
        logger.error(`#${number} が見つかりません`);
        return 1;
    }
    return await updateIssue(issueNode, owner, repo, number, options, logger);
}
/**
 * コメントを更新する。
 */
async function updateComment(commentIdStr, bodyStr, issueNumber, logger) {
    // bodyStr がファイルパスの場合は読み込む
    let body = bodyStr;
    if (existsSync(bodyStr)) {
        const { body: fileBody, error } = readBodyFromFile(bodyStr);
        if (error) {
            logger.error(error);
            return 1;
        }
        body = fileBody ?? bodyStr;
    }
    body = stripFrontmatter(body);
    const result = await runGraphQL(GRAPHQL_MUTATION_UPDATE_COMMENT, { id: commentIdStr, body });
    if (!result.success) {
        logger.error(`コメント ${commentIdStr} の更新に失敗しました`);
        return 1;
    }
    logger.success(`コメント ${commentIdStr} を更新しました`);
    console.log(JSON.stringify({
        number: issueNumber,
        updated_fields: ["comment"],
        comment_id: commentIdStr,
        result: "ok",
    }, null, 2));
    return 0;
}
/**
 * Discussion を更新する。
 */
async function updateDiscussion(discussion, number, options, logger) {
    const newTitle = options.title ?? discussion.title;
    let newBody = discussion.body ?? "";
    if (options.body) {
        if (existsSync(options.body)) {
            const { body: fileBody, error } = readBodyFromFile(options.body);
            if (error) {
                logger.error(error);
                return 1;
            }
            newBody = fileBody ?? newBody;
        }
        else {
            newBody = options.body;
        }
        newBody = stripFrontmatter(newBody);
    }
    const result = await runGraphQL(GRAPHQL_MUTATION_UPDATE_DISCUSSION, { id: discussion.id ?? "", title: newTitle ?? "", body: newBody });
    if (!result.success) {
        logger.error(`Discussion #${number} の更新に失敗しました`);
        return 1;
    }
    const updatedFields = [];
    if (options.title)
        updatedFields.push("title");
    if (options.body)
        updatedFields.push("body");
    logger.success(`Discussion #${number} を更新しました`);
    console.log(JSON.stringify({
        number,
        updated_fields: updatedFields,
        result: "ok",
    }, null, 2));
    return 0;
}
/**
 * Issue を更新する。
 */
async function updateIssue(issue, owner, repo, number, options, logger) {
    const updatedFields = [];
    const issueId = issue.id ?? "";
    // --status: 遷移バリデーション
    if (options.status) {
        const currentStatus = issue.projectItems?.nodes?.[0]?.status?.name;
        const validation = validateStatusTransition(currentStatus, options.status);
        if (!validation.valid) {
            logger.error(validation.warning ?? "ステータス遷移が許可されていません");
            return 1;
        }
    }
    // 本文・タイトル更新
    const updateVars = { id: issueId };
    let hasBodyTitleUpdate = false;
    if (options.title) {
        updateVars.title = options.title;
        hasBodyTitleUpdate = true;
    }
    if (options.body) {
        let body = options.body;
        if (existsSync(options.body)) {
            const { body: fileBody, error } = readBodyFromFile(options.body);
            if (error) {
                logger.error(error);
                return 1;
            }
            body = fileBody ?? body;
        }
        body = stripFrontmatter(body);
        updateVars.body = body;
        hasBodyTitleUpdate = true;
    }
    if (hasBodyTitleUpdate) {
        const result = await runGraphQL(GRAPHQL_MUTATION_UPDATE_ISSUE, updateVars);
        if (!result.success) {
            logger.error(`Issue #${number} の本文/タイトル更新に失敗しました`);
            return 1;
        }
        if (options.title)
            updatedFields.push("title");
        if (options.body && !options.comment)
            updatedFields.push("body");
        logger.success(`Issue #${number}: 本文/タイトルを更新しました`);
    }
    // ステータス更新
    if (options.status) {
        const statusResult = await resolveAndUpdateStatus(owner, repo, number, options.status, logger);
        if (!statusResult.success) {
            logger.error(`Issue #${number}: ステータス更新に失敗しました`);
            return 1;
        }
        updatedFields.push("status");
        logger.success(`Issue #${number}: ステータスを ${options.status} に更新しました`);
    }
    // Priority / Size 更新
    if (options.priority || options.size) {
        const issueDetail = await getIssueDetail(owner, repo, number);
        if (issueDetail?.projectId && issueDetail?.projectItemId) {
            const projectFields = await getProjectFields(issueDetail.projectId);
            if (projectFields) {
                const fieldUpdates = {};
                if (options.priority)
                    fieldUpdates["Priority"] = options.priority;
                if (options.size)
                    fieldUpdates["Size"] = options.size;
                await setItemFields(issueDetail.projectId, issueDetail.projectItemId, fieldUpdates, logger, projectFields);
                if (options.priority)
                    updatedFields.push("priority");
                if (options.size)
                    updatedFields.push("size");
            }
        }
    }
    // ラベル更新
    if (options.labels || options.addLabel || options.removeLabel) {
        const labelMap = await getLabels(owner, repo);
        const currentLabelIds = (issue.labels?.nodes ?? [])
            .map((l) => l.id ?? "")
            .filter(Boolean);
        if (options.labels) {
            // ラベルを上書き設定
            const labelNames = normalizeLabels(options.labels.split(","));
            const labelIds = labelNames.map((n) => labelMap[n]).filter(Boolean);
            await runGraphQL(GRAPHQL_MUTATION_SET_LABELS, {
                labelableId: issueId,
                labelIds,
            });
            updatedFields.push("labels");
        }
        if (options.addLabel) {
            const labelId = labelMap[options.addLabel];
            if (labelId) {
                await runGraphQL(GRAPHQL_MUTATION_ADD_LABELS, {
                    labelableId: issueId,
                    labelIds: [labelId],
                });
                updatedFields.push("labels");
            }
            else {
                logger.warn(`ラベル "${options.addLabel}" が見つかりません`);
            }
        }
        if (options.removeLabel) {
            const labelId = labelMap[options.removeLabel];
            if (labelId && currentLabelIds.includes(labelId)) {
                await runGraphQL(GRAPHQL_MUTATION_REMOVE_LABELS, {
                    labelableId: issueId,
                    labelIds: [labelId],
                });
                updatedFields.push("labels");
            }
            else {
                logger.warn(`ラベル "${options.removeLabel}" が見つかりません`);
            }
        }
    }
    // 担当者更新
    if (options.assign || options.unassign) {
        if (options.assign) {
            const login = await resolveLogin(options.assign);
            const userId = await getUserId(login);
            if (userId) {
                await runGraphQL(GRAPHQL_MUTATION_ADD_ASSIGNEES, {
                    assignableId: issueId,
                    assigneeIds: [userId],
                });
                updatedFields.push("assignees");
            }
            else {
                logger.warn(`ユーザー "${options.assign}" が見つかりません`);
            }
        }
        if (options.unassign) {
            const login = await resolveLogin(options.unassign);
            const currentAssignee = (issue.assignees?.nodes ?? []).find((a) => a.login === login);
            if (currentAssignee?.id) {
                await runGraphQL(GRAPHQL_MUTATION_REMOVE_ASSIGNEES, {
                    assignableId: issueId,
                    assigneeIds: [currentAssignee.id],
                });
                updatedFields.push("assignees");
            }
            else {
                logger.warn(`担当者 "${options.unassign}" が見つかりません`);
            }
        }
    }
    // キャッシュを更新
    const cached = readContextCache("issues", String(number));
    if (cached) {
        const updatedCache = { ...cached };
        if (options.status)
            updatedCache.status = options.status;
        if (options.title)
            updatedCache.title = options.title;
        if (updateVars.body)
            updatedCache.body = updateVars.body;
        writeContextCache("issues", String(number), updatedCache);
    }
    logger.success(`Issue #${number} を更新しました`);
    console.log(JSON.stringify({
        number,
        updated_fields: updatedFields,
        result: "ok",
    }, null, 2));
    return 0;
}
//# sourceMappingURL=index.js.map