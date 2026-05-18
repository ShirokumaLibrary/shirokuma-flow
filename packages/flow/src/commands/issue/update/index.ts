/**
 * items update サブコマンド (#2024 Phase 1-A)
 *
 * Issue / Discussion の本文・メタデータを1コマンドで更新する。
 * `items pull → 編集 → items push` の3ステップを置き換える。
 *
 * 対応フィールド:
 * - body ([body-file] positional): 本文をファイル内容で更新
 * - title (--title <title>): タイトルを更新
 * - status (--status <status>): ステータスを更新（transition バリデーション通過後）
 * - priority (--priority <priority>): Priority を更新
 * - size (--size <size>): Size を更新
 * - labels (--labels <labels>): ラベルを上書き設定
 * - add-label (--add-label <label>): ラベルを追加
 * - remove-label (--remove-label <label>): ラベルを削除
 * - assign (--assign <user>): 担当者を追加
 * - unassign (--unassign <user>): 担当者を削除
 * - comment (--comment <id> [body-file] positional): 既存コメントを更新
 */

import { runGraphQL, parseIssueNumber, isIssueNumber } from "../../../utils/github.js";
import { getOctokit } from "../../../utils/octokit-client.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import { resolveBodyFileOption } from "../../../utils/cli-helpers.js";
import { validateTransition } from "../../../utils/status-workflow.js";
import { resolveAndUpdateStatus, getIssueDetail } from "../../../utils/issue-detail.js";
import { stripFrontmatter } from "../../../utils/frontmatter-strip.js";
import {
  getProjectFields,
  setItemFields,
} from "../../../utils/project-fields.js";
import { getProjectId } from "../../../utils/project-utils.js";
import {
  readContextCache,
  writeContextCache,
} from "../../../utils/context-cache.js";
import { getLabels, normalizeLabels } from "../../items/helpers.js";
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../../items/types.js";
import type { ContextTarget } from "../context/index.js";

// =============================================================================
// オプション型
// =============================================================================

/** items update サブコマンドのオプション */
export interface UpdateOptions extends ItemsOptions {
  /** 本文ファイルパス（--comment 指定時はコメント本文として扱う） */
  bodyFile?: string;
  /** タイトルを更新 */
  title?: string;
  /** ステータスを更新（transition バリデーション通過後） */
  status?: string;
  /** Priority を更新 */
  priority?: string;
  /** Size を更新 */
  size?: string;
  /** ラベルを上書き設定（カンマ区切り） */
  labels?: string;
  /** ラベルを追加 */
  addLabel?: string;
  /** ラベルを削除 */
  removeLabel?: string;
  /** 担当者を追加 */
  assign?: string;
  /** 担当者を削除 */
  unassign?: string;
  /** コメント ID（既存コメント更新時） */
  comment?: string;
}

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
// 型定義
// =============================================================================

interface ItemForUpdateResult {
  data?: {
    repository?: {
      issue?: {
        id?: string;
        title?: string;
        body?: string;
        state?: string;
        labels?: { nodes?: Array<{ id?: string; name?: string }> };
        assignees?: { nodes?: Array<{ id?: string; login?: string }> };
        projectItems?: {
          nodes?: Array<{
            status?: { name?: string } | null;
          }>;
        };
      };
      discussion?: {
        id?: string;
        title?: string;
        body?: string;
      };
    };
  };
}

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * @me を実際のログインに解決する。
 */
async function resolveLogin(login: string): Promise<string> {
  if (login !== "@me") return login;
  try {
    const octokit = getOctokit();
    const { data: authUser } = await octokit.rest.users.getAuthenticated();
    return authUser.login;
  } catch {
    return login;
  }
}

/**
 * ログイン名から GitHub ユーザー GraphQL ID を取得する。
 */
async function getUserId(login: string): Promise<string | null> {
  interface UserIdResult {
    data?: { user?: { id?: string } };
  }
  const result = await runGraphQL<UserIdResult>(GRAPHQL_QUERY_USER_ID, { login });
  if (!result.success) return null;
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
export async function cmdItemUpdate(
  numberStr: string,
  options: UpdateOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(numberStr)) {
    logger.error("有効なアイテム番号を指定してください");
    return 1;
  }

  // [body-file] positional をファイル内容に解決する。
  // インライン文字列を本文として受理してしまう dual-path をここで構造的に封鎖する (#2485 Critical-1)。
  if (!resolveBodyFileOption(options as Record<string, unknown>)) return 1;

  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("リポジトリを特定できません");
    return 1;
  }

  const { owner, name: repo } = repoInfo;
  const number = parseIssueNumber(numberStr);

  // オプションが1つも指定されていない場合はエラー
  const hasBodyUpdate = !!options.bodyFile;
  const hasCommentUpdate = !!options.comment && !!options.bodyFile;
  const hasMetaUpdate = !!(
    options.title || options.status || options.priority || options.size ||
    options.labels || options.addLabel || options.removeLabel ||
    options.assign || options.unassign
  );

  if (!hasBodyUpdate && !hasMetaUpdate && !hasCommentUpdate) {
    logger.error("更新するフィールドを少なくとも1つ指定してください");
    return 1;
  }

  // --comment --body でコメント更新
  if (options.comment && options.bodyFile) {
    return await updateComment(options.comment, options.bodyFile, number, logger);
  }

  // アイテム情報を取得
  const itemResult = await runGraphQL<ItemForUpdateResult>(
    GRAPHQL_QUERY_ITEM_FOR_UPDATE,
    { owner, name: repo, number }
  );

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
 *
 * `bodyStr` は呼び出し前に `resolveBodyFileOption` でファイル内容に解決済み。
 */
async function updateComment(
  commentIdStr: string,
  bodyStr: string,
  issueNumber: number,
  logger: Logger
): Promise<number> {
  const body = stripFrontmatter(bodyStr);

  interface UpdateCommentResult {
    data?: { updateIssueComment?: { issueComment?: { id?: string } } };
  }

  const result = await runGraphQL<UpdateCommentResult>(
    GRAPHQL_MUTATION_UPDATE_COMMENT,
    { id: commentIdStr, body }
  );

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
async function updateDiscussion(
  discussion: { id?: string; title?: string; body?: string },
  number: number,
  options: UpdateOptions,
  logger: Logger
): Promise<number> {
  const newTitle = options.title ?? discussion.title;
  let newBody = discussion.body ?? "";

  // options.bodyFile は cmdItemUpdate 入口で resolveBodyFileOption によりファイル内容に解決済み
  if (options.bodyFile) {
    newBody = stripFrontmatter(options.bodyFile);
  }

  interface UpdateDiscussionResult {
    data?: { updateDiscussion?: { discussion?: { id?: string } } };
  }

  const result = await runGraphQL<UpdateDiscussionResult>(
    GRAPHQL_MUTATION_UPDATE_DISCUSSION,
    { id: discussion.id ?? "", title: newTitle ?? "", body: newBody }
  );

  if (!result.success) {
    logger.error(`Discussion #${number} の更新に失敗しました`);
    return 1;
  }

  const updatedFields: string[] = [];
  if (options.title) updatedFields.push("title");
  if (options.bodyFile) updatedFields.push("body");

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
async function updateIssue(
  issue: NonNullable<NonNullable<NonNullable<ItemForUpdateResult["data"]>["repository"]>["issue"]>,
  owner: string,
  repo: string,
  number: number,
  options: UpdateOptions,
  logger: Logger
): Promise<number> {
  const updatedFields: string[] = [];
  const issueId = issue.id ?? "";

  // --status: 遷移バリデーション
  if (options.status) {
    const currentStatus = issue.projectItems?.nodes?.[0]?.status?.name;
    const validation = validateTransition("issue", currentStatus, options.status);
    if (!validation.valid) {
      logger.error(validation.error ?? "ステータス遷移が許可されていません");
      return 1;
    }
  }

  // 本文・タイトル更新
  const updateVars: Record<string, string> = { id: issueId };
  let hasBodyTitleUpdate = false;

  if (options.title) {
    updateVars.title = options.title;
    hasBodyTitleUpdate = true;
  }

  // options.bodyFile は cmdItemUpdate 入口で resolveBodyFileOption によりファイル内容に解決済み
  if (options.bodyFile) {
    updateVars.body = stripFrontmatter(options.bodyFile);
    hasBodyTitleUpdate = true;
  }

  if (hasBodyTitleUpdate) {
    interface UpdateIssueResult {
      data?: { updateIssue?: { issue?: { id?: string } } };
    }

    const result = await runGraphQL<UpdateIssueResult>(
      GRAPHQL_MUTATION_UPDATE_ISSUE,
      updateVars as Record<string, string>
    );

    if (!result.success) {
      logger.error(`Issue #${number} の本文/タイトル更新に失敗しました`);
      return 1;
    }

    if (options.title) updatedFields.push("title");
    if (options.bodyFile && !options.comment) updatedFields.push("body");
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
        const fieldUpdates: Record<string, string> = {};
        if (options.priority) fieldUpdates["Priority"] = options.priority;
        if (options.size) fieldUpdates["Size"] = options.size;

        await setItemFields(
          issueDetail.projectId,
          issueDetail.projectItemId,
          fieldUpdates,
          logger,
          projectFields
        );

        if (options.priority) updatedFields.push("priority");
        if (options.size) updatedFields.push("size");
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

      interface SetLabelsResult {
        data?: { setLabelsToLabelable?: unknown };
      }

      await runGraphQL<SetLabelsResult>(GRAPHQL_MUTATION_SET_LABELS, {
        labelableId: issueId,
        labelIds,
      });
      updatedFields.push("labels");
    }

    if (options.addLabel) {
      const labelId = labelMap[options.addLabel];
      if (labelId) {
        interface AddLabelsResult {
          data?: { addLabelsToLabelable?: unknown };
        }
        await runGraphQL<AddLabelsResult>(GRAPHQL_MUTATION_ADD_LABELS, {
          labelableId: issueId,
          labelIds: [labelId],
        });
        updatedFields.push("labels");
      } else {
        logger.warn(`ラベル "${options.addLabel}" が見つかりません`);
      }
    }

    if (options.removeLabel) {
      const labelId = labelMap[options.removeLabel];
      if (labelId && currentLabelIds.includes(labelId)) {
        interface RemoveLabelsResult {
          data?: { removeLabelsFromLabelable?: unknown };
        }
        await runGraphQL<RemoveLabelsResult>(GRAPHQL_MUTATION_REMOVE_LABELS, {
          labelableId: issueId,
          labelIds: [labelId],
        });
        updatedFields.push("labels");
      } else {
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
        interface AddAssigneesResult {
          data?: { addAssigneesToAssignable?: unknown };
        }
        await runGraphQL<AddAssigneesResult>(GRAPHQL_MUTATION_ADD_ASSIGNEES, {
          assignableId: issueId,
          assigneeIds: [userId],
        });
        updatedFields.push("assignees");
      } else {
        logger.warn(`ユーザー "${options.assign}" が見つかりません`);
      }
    }

    if (options.unassign) {
      const login = await resolveLogin(options.unassign);
      const currentAssignee = (issue.assignees?.nodes ?? []).find((a) => a.login === login);
      if (currentAssignee?.id) {
        interface RemoveAssigneesResult {
          data?: { removeAssigneesFromAssignable?: unknown };
        }
        await runGraphQL<RemoveAssigneesResult>(GRAPHQL_MUTATION_REMOVE_ASSIGNEES, {
          assignableId: issueId,
          assigneeIds: [currentAssignee.id],
        });
        updatedFields.push("assignees");
      } else {
        logger.warn(`担当者 "${options.unassign}" が見つかりません`);
      }
    }
  }

  // キャッシュを更新
  const cached = readContextCache<ContextTarget>("issues", String(number));
  if (cached) {
    const updatedCache = { ...cached };
    if (options.status) updatedCache.status = options.status;
    if (options.title) updatedCache.title = options.title;
    if (updateVars.body) updatedCache.body = updateVars.body as string;
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
