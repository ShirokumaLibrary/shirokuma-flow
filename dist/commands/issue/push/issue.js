/**
 * items push - Issue 本体の push ロジック (#1808, #1810)
 *
 * @related pull/issue.ts - Issue 取得・キャッシュ書き込み
 * @related add/issue.ts - Issue 作成ロジック
 */
import { runGraphQL, validateBody } from "../../../utils/github.js";
import { getOctokit } from "../../../utils/octokit-client.js";
import { getLabels, resolveIssueTypeId, getIssueInternalId, } from "../../items/helpers.js";
import { writeCache } from "../../../utils/github-cache.js";
import { getProjectFields, setItemFields, addItemToProject, } from "../../../utils/project-fields.js";
import { getProjectId } from "../../../utils/project-utils.js";
import { STATUS_VALUES, isBackwardTransition } from "../../../utils/status-workflow.js";
import { resolveAndUpdateStatus, updateProjectStatus } from "../../../utils/issue-detail.js";
import { GRAPHQL_MUTATION_CLOSE_ISSUE, GRAPHQL_MUTATION_REOPEN_ISSUE, GRAPHQL_MUTATION_ADD_COMMENT, } from "../../../utils/graphql-queries.js";
import { syncParentStatus } from "../../../utils/parent-status.js";
// =============================================================================
// GraphQL ミューテーション定義
// =============================================================================
export const GRAPHQL_MUTATION_UPDATE_ISSUE = `
mutation($id: ID!, $title: String, $body: String, $issueTypeId: ID) {
  updateIssue(input: {id: $id, title: $title, body: $body, issueTypeId: $issueTypeId}) {
    issue { id number title body updatedAt issueType { id name } }
  }
}
`;
export const GRAPHQL_MUTATION_ADD_LABELS = `
mutation($labelableId: ID!, $labelIds: [ID!]!) {
  addLabelsToLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {
    labelable { ... on Issue { id number labels(first: 20) { nodes { name } } } }
  }
}
`;
export const GRAPHQL_MUTATION_REMOVE_LABELS = `
mutation($labelableId: ID!, $labelIds: [ID!]!) {
  removeLabelsFromLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {
    labelable { ... on Issue { id number labels(first: 20) { nodes { name } } } }
  }
}
`;
/** Issue の GraphQL ID + 本文 + Projects フィールド + ラベル + 担当者を一括取得 */
export const GRAPHQL_QUERY_ISSUE_FOR_PUSH = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id
      title
      body
      state
      updatedAt
      issueType { id name }
      labels(first: 20) { nodes { name } }
      assignees(first: 10) { nodes { login } }
      projectItems(first: 5) {
        nodes {
          id
          project { id title }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
          }
          priority: fieldValueByName(name: "Priority") {
            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
          }
          size: fieldValueByName(name: "Size") {
            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
          }
        }
      }
    }
  }
}
`;
// =============================================================================
// ヘルパー
// =============================================================================
/** ローカルとリモートの配列差分を計算する */
export function computeArrayDiff(local, remote) {
    if (local === null)
        return { toAdd: [], toRemove: [] };
    const toAdd = local.filter((v) => !remote.includes(v));
    const toRemove = remote.filter((v) => !local.includes(v));
    return { toAdd, toRemove };
}
/**
 * 重要なステータス遷移かどうかを判定する (#1937)
 *
 * 重要遷移: → Completed, → Review, → Done, 後退遷移（補償差し戻し）
 * 通常遷移（Backlog → In Progress 等）は GitHub Projects Activity ログに委ねる。
 */
const IMPORTANT_TARGET_STATUSES = new Set([
    STATUS_VALUES.COMPLETED,
    STATUS_VALUES.REVIEW,
    STATUS_VALUES.DONE,
]);
/** 重要遷移の場合に自動コメントを投稿する（best-effort） */
async function postStatusTransitionComment(issueId, number, from, to, logger) {
    const backward = isBackwardTransition(from, to);
    if (!IMPORTANT_TARGET_STATUSES.has(to) && !backward)
        return;
    try {
        const label = backward ? " (差し戻し)" : "";
        const body = `**Status:** ${from} → ${to}${label}`;
        await runGraphQL(GRAPHQL_MUTATION_ADD_COMMENT, {
            subjectId: issueId,
            body,
        });
        logger.debug(`Issue #${number}: status transition comment posted`);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.debug(`postStatusTransitionComment: best-effort error for #${number}: ${msg}`);
    }
}
// =============================================================================
// Issue 本体 push
// =============================================================================
/** Issue 本体を push */
export async function pushIssueBody(owner, repo, number, localBody, localMeta, options, logger) {
    // 本文の不正 Unicode 検証
    const bodyError = validateBody(localBody);
    if (bodyError) {
        logger.error(bodyError);
        return 1;
    }
    // リモートから現在の Issue 情報を一括取得（ID + 本文 + Projects フィールド）
    const remoteResult = await runGraphQL(GRAPHQL_QUERY_ISSUE_FOR_PUSH, {
        owner,
        name: repo,
        number,
    });
    if (!remoteResult.success || !remoteResult.data?.data?.repository?.issue) {
        logger.error(`Issue #${number} が見つかりません`);
        return 1;
    }
    const remoteIssue = remoteResult.data.data.repository.issue;
    const issueId = remoteIssue.id;
    const projectName = repo;
    const projectItems = remoteIssue.projectItems?.nodes ?? [];
    const matchingItem = projectItems.find((p) => p?.project?.title === projectName) ?? projectItems[0];
    // 差分を検出
    const changes = {};
    // 本文の差分
    const remoteBody = remoteIssue.body ?? "";
    if (localBody.trim() !== remoteBody.trim()) {
        changes.body = { local: localBody, remote: remoteBody };
    }
    // タイトルの差分
    const remoteTitle = remoteIssue.title ?? "";
    const localTitle = typeof localMeta.title === "string" ? localMeta.title : "";
    if (localTitle && localTitle !== remoteTitle) {
        changes.title = { local: localTitle, remote: remoteTitle };
    }
    // Projects フィールドの差分（status/priority/size）
    const remoteStatus = matchingItem?.status?.name;
    const remotePriority = matchingItem?.priority?.name;
    const remoteSize = matchingItem?.size?.name;
    const localStatus = typeof localMeta.status === "string" ? localMeta.status : undefined;
    const localPriority = typeof localMeta.priority === "string" ? localMeta.priority : undefined;
    const localSize = typeof localMeta.size === "string" ? localMeta.size : undefined;
    // Status は updateProjectStatus 経由で更新する（#2207 型レベル強制）。
    // Priority/Size など非 Status フィールドのみ setItemFields に渡す。
    let pendingStatusValue;
    const projectFieldChanges = {};
    if (localStatus && localStatus !== remoteStatus) {
        changes.status = { local: localStatus, remote: remoteStatus };
        pendingStatusValue = localStatus;
    }
    if (localPriority && localPriority !== remotePriority) {
        changes.priority = { local: localPriority, remote: remotePriority };
        projectFieldChanges["Priority"] = localPriority;
    }
    if (localSize && localSize !== remoteSize) {
        changes.size = { local: localSize, remote: remoteSize };
        projectFieldChanges["Size"] = localSize;
    }
    // ラベルの差分（frontmatter labels フィールドが存在する場合のみ）
    const remoteLabels = (remoteIssue.labels?.nodes ?? []).map((l) => l?.name ?? "").filter(Boolean);
    const localLabels = Array.isArray(localMeta.labels) ? localMeta.labels.filter(Boolean) : null;
    const labelDiff = computeArrayDiff(localLabels, remoteLabels);
    if (labelDiff.toAdd.length > 0 || labelDiff.toRemove.length > 0) {
        changes.labels = { local: localLabels, remote: remoteLabels };
    }
    // 担当者の差分（frontmatter assignees フィールドが存在する場合のみ）
    const remoteAssignees = (remoteIssue.assignees?.nodes ?? []).map((a) => a?.login ?? "").filter(Boolean);
    // @me を実際のログインに解決
    let localAssigneesRaw = Array.isArray(localMeta.assignees) ? localMeta.assignees.filter(Boolean) : null;
    if (localAssigneesRaw && localAssigneesRaw.includes("@me")) {
        try {
            const octokit = getOctokit();
            const { data: authUser } = await octokit.rest.users.getAuthenticated();
            localAssigneesRaw = localAssigneesRaw.map((a) => a === "@me" ? authUser.login : a);
        }
        catch {
            logger.warn("@me の解決に失敗しました");
        }
    }
    const localAssignees = localAssigneesRaw;
    const assigneeDiff = computeArrayDiff(localAssignees, remoteAssignees);
    if (assigneeDiff.toAdd.length > 0 || assigneeDiff.toRemove.length > 0) {
        changes.assignees = { local: localAssignees, remote: remoteAssignees };
    }
    // issue-type の差分（frontmatter issue-type フィールドが存在する場合のみ）
    const remoteIssueTypeName = remoteIssue.issueType?.name;
    const localIssueTypeName = typeof localMeta.issue_type === "string" ? localMeta.issue_type : undefined;
    let resolvedIssueTypeId;
    if (localIssueTypeName && localIssueTypeName !== remoteIssueTypeName) {
        changes.issue_type = { local: localIssueTypeName, remote: remoteIssueTypeName };
    }
    // state の差分（frontmatter state フィールドが存在する場合のみ）
    const remoteStateRaw = remoteIssue.state; // "OPEN" | "CLOSED"
    const localState = typeof localMeta.state === "string" ? localMeta.state.toUpperCase() : undefined;
    if (localState && localState !== remoteStateRaw) {
        changes.state = { local: localState, remote: remoteStateRaw };
    }
    // parent の差分（frontmatter parent フィールドが存在する場合のみ）
    const localParent = typeof localMeta.parent === "number" ? localMeta.parent : undefined;
    if (localParent !== undefined) {
        changes.parent = { local: localParent, remote: undefined };
    }
    if (Object.keys(changes).length === 0) {
        logger.info(`Issue #${number}: 差分なし`);
        console.log(JSON.stringify({ number, type: "issue", changed: false }, null, 2));
        return 0;
    }
    // Issue 本文・タイトル・issue-type 更新
    if (changes.body || changes.title || changes.issue_type) {
        if (!issueId) {
            logger.error(`Issue #${number} の GraphQL ID が取得できません`);
            return 1;
        }
        // issue-type を解決
        if (changes.issue_type && localIssueTypeName) {
            const resolved = await resolveIssueTypeId(owner, localIssueTypeName, logger);
            if (resolved === false)
                return 1;
            resolvedIssueTypeId = resolved;
        }
        const updateResult = await runGraphQL(GRAPHQL_MUTATION_UPDATE_ISSUE, {
            id: issueId,
            title: changes.title ? localTitle : remoteTitle,
            body: changes.body ? localBody : remoteBody,
            ...(changes.issue_type ? { issueTypeId: resolvedIssueTypeId ?? null } : {}),
        });
        if (!updateResult.success) {
            logger.error(`Issue #${number} の本文更新に失敗しました`);
            return 1;
        }
        if (changes.body || changes.title) {
            logger.success(`Issue #${number}: 本文を更新しました`);
        }
        if (changes.issue_type) {
            logger.success(`Issue #${number}: Issue Type を更新しました: ${localIssueTypeName}`);
        }
    }
    // Projects フィールド更新
    // Status は updateProjectStatus 経由（#2207）、非 Status フィールドは setItemFields 経由。
    const hasNonStatusChanges = Object.keys(projectFieldChanges).length > 0;
    if (hasNonStatusChanges || pendingStatusValue) {
        if (matchingItem?.id && matchingItem?.project?.id) {
            const pId = matchingItem.project.id;
            const iId = matchingItem.id;
            const pf = await getProjectFields(pId);
            // 非 Status フィールド（Priority/Size）更新
            if (hasNonStatusChanges) {
                const count = await setItemFields(pId, iId, projectFieldChanges, logger, pf);
                if (count > 0) {
                    logger.success(`Issue #${number}: ${count} 個のプロジェクトフィールドを更新しました`);
                }
            }
            // Status 更新（updateProjectStatus 経由で遷移バリデーション + autoSetTimestamps）
            if (pendingStatusValue) {
                const result = await updateProjectStatus({
                    projectId: pId,
                    itemId: iId,
                    statusValue: pendingStatusValue,
                    projectFields: pf,
                    logger,
                    previousStatus: remoteStatus,
                    force: options.force,
                });
                if (!result.success) {
                    // バリデーション失敗でブロックされた場合
                    return 1;
                }
            }
        }
        else {
            // プロジェクトアイテムが見つからない場合は追加を試みる
            const projectId = await getProjectId(owner, repo);
            if (projectId && issueId) {
                const itemId = await addItemToProject(projectId, issueId, logger);
                if (itemId) {
                    const pf = await getProjectFields(projectId);
                    // 非 Status フィールド更新
                    if (hasNonStatusChanges) {
                        const count = await setItemFields(projectId, itemId, projectFieldChanges, logger, pf);
                        if (count > 0) {
                            logger.success(`Issue #${number}: ${count} 個のプロジェクトフィールドを更新しました`);
                        }
                    }
                    // Status 更新（新規追加アイテムのため previousStatus は undefined）
                    if (pendingStatusValue) {
                        const result = await updateProjectStatus({
                            projectId,
                            itemId,
                            statusValue: pendingStatusValue,
                            projectFields: pf,
                            logger,
                            previousStatus: undefined,
                            force: options.force,
                        });
                        if (!result.success) {
                            return 1;
                        }
                    }
                }
            }
            else {
                logger.warn("プロジェクトが見つかりません。Projects フィールドの更新をスキップします");
            }
        }
    }
    // ラベル・担当者更新（本文/Projects 更新と独立なので並列実行）
    const sideEffects = [];
    if (changes.labels && issueId) {
        sideEffects.push((async () => {
            const allLabels = await getLabels(owner, repo);
            if (labelDiff.toAdd.length > 0) {
                const addIds = labelDiff.toAdd.map((n) => allLabels[n]).filter(Boolean);
                if (addIds.length > 0) {
                    const addResult = await runGraphQL(GRAPHQL_MUTATION_ADD_LABELS, { labelableId: issueId, labelIds: addIds });
                    if (addResult.success) {
                        logger.success(`Issue #${number}: ${addIds.length} 件のラベルを追加しました`);
                    }
                }
            }
            if (labelDiff.toRemove.length > 0) {
                const removeIds = labelDiff.toRemove.map((n) => allLabels[n]).filter(Boolean);
                if (removeIds.length > 0) {
                    const removeResult = await runGraphQL(GRAPHQL_MUTATION_REMOVE_LABELS, { labelableId: issueId, labelIds: removeIds });
                    if (removeResult.success) {
                        logger.success(`Issue #${number}: ${removeIds.length} 件のラベルを削除しました`);
                    }
                }
            }
        })());
    }
    if (changes.assignees) {
        sideEffects.push((async () => {
            const octokit = getOctokit();
            if (assigneeDiff.toAdd.length > 0) {
                try {
                    await octokit.rest.issues.addAssignees({ owner, repo, issue_number: number, assignees: assigneeDiff.toAdd });
                    logger.success(`Issue #${number}: 担当者を追加しました: ${assigneeDiff.toAdd.join(", ")}`);
                }
                catch (err) {
                    logger.error(`担当者の追加に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            if (assigneeDiff.toRemove.length > 0) {
                try {
                    await octokit.rest.issues.removeAssignees({ owner, repo, issue_number: number, assignees: assigneeDiff.toRemove });
                    logger.success(`Issue #${number}: 担当者を削除しました: ${assigneeDiff.toRemove.join(", ")}`);
                }
                catch (err) {
                    logger.error(`担当者の削除に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        })());
    }
    await Promise.all(sideEffects);
    // state の変更（close/reopen）
    if (changes.state && issueId) {
        if (localState === "CLOSED") {
            // close: state-reason は frontmatter state_reason フィールドから
            const stateReason = typeof localMeta.state_reason === "string"
                ? localMeta.state_reason.toUpperCase()
                : "COMPLETED";
            const resolvedReason = stateReason === "NOT_PLANNED" ? "NOT_PLANNED" : "COMPLETED";
            const closeResult = await runGraphQL(GRAPHQL_MUTATION_CLOSE_ISSUE, {
                issueId,
                stateReason: resolvedReason,
            });
            if (!closeResult.success) {
                logger.error(`Issue #${number} のクローズに失敗しました`);
                return 1;
            }
            logger.success(`Issue #${number} をクローズしました (${resolvedReason})`);
            // NOT_PLANNED も Done に統合（state_reason で識別）
            const targetStatus = STATUS_VALUES.DONE;
            const statusResult = await resolveAndUpdateStatus(owner, repo, number, targetStatus, logger);
            if (statusResult.success) {
                logger.success(`Issue #${number} → ${targetStatus}`);
            }
        }
        else if (localState === "OPEN") {
            const reopenResult = await runGraphQL(GRAPHQL_MUTATION_REOPEN_ISSUE, {
                issueId,
            });
            if (!reopenResult.success) {
                logger.error(`Issue #${number} の再オープンに失敗しました`);
                return 1;
            }
            logger.success(`Issue #${number} を再オープンしました`);
        }
    }
    // parent の設定（sub-issue として紐付け）
    if (changes.parent && localParent !== undefined) {
        const childInternalId = await getIssueInternalId(owner, repo, number);
        if (!childInternalId) {
            logger.error(`Issue #${number} の内部 ID が取得できません`);
            return 1;
        }
        try {
            const octokit = getOctokit();
            await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues", {
                owner,
                repo,
                issue_number: localParent,
                sub_issue_id: childInternalId,
            });
            logger.success(`Issue #${number} を #${localParent} のサブ Issue に設定しました`);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error(`parent の設定に失敗しました: ${message}`);
            return 1;
        }
    }
    if (pendingStatusValue) {
        await Promise.all([
            issueId && remoteStatus
                ? postStatusTransitionComment(issueId, number, remoteStatus, pendingStatusValue, logger)
                : Promise.resolve(),
            syncParentStatus(owner, repo, number, logger),
        ]);
    }
    // キャッシュの cached_at を更新
    writeCache(number, {
        ...localMeta,
        number,
        type: "issue",
    }, localBody, owner, repo);
    console.log(JSON.stringify({
        number,
        type: "issue",
        changed: true,
        changes: Object.keys(changes),
    }, null, 2));
    return 0;
}
//# sourceMappingURL=issue.js.map