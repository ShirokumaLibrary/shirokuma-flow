/**
 * Issue detail resolution and Status update helpers (#676)
 *
 * GraphQL クエリ定数と Issue → Project Item 解決ロジックを集約。
 * issues.ts, issues-pr.ts, session.ts の Status 更新を共通化する。
 *
 * 3層構造:
 * - updateProjectStatus(): projectId/itemId 既知の場合（低レベル）
 * - resolveProjectItem(): issueNumber → projectId/itemId/fields を一括取得
 * - resolveAndUpdateStatus(): issueNumber → Status 更新を一発で（ファサード）
 *
 * setFieldsWithStatusRouting(): 非 Status フィールドと Status を一括設定する共通ヘルパー (#2173)
 */

import { runGraphQL } from "./github.js";
import { Logger } from "./logger.js";
import {
  getProjectFields,
  setItemFields,
  autoSetTimestamps,
  type ProjectField,
  type NonStatusFields,
} from "./project-fields.js";
import { getProjectId } from "./project-utils.js";
import { removeOpenIssuesEntry } from "./github-cache.js";
import { STATUS_VALUES, LEGACY_STATUS_VALUES } from "./status-workflow.js";

/** open-issues インデックスから除去対象となる終了ステータス。
 * TERMINAL_STATUSES（status-workflow.ts）とは用途が異なる:
 * - Cancelled は items cancel が直接 removeOpenIssuesEntry を呼ぶため除外
 * - Completed は LEGACY 値だがインデックスからは除去する（#2439: 5 値モデル移行後も旧値対応）
 */
const CLOSE_STATUSES: readonly string[] = [
  STATUS_VALUES.DONE,
  LEGACY_STATUS_VALUES.COMPLETED_LEGACY, // #2440: "Completed" LEGACY 値（5 値モデル移行後も旧値対応）
];

// =============================================================================
// GraphQL Query
// =============================================================================

/**
 * PR の projectItemId, projectId, status を GraphQL で取得するクエリ。
 * `repository.pullRequest(number:$number)` を使用する（Issue クエリとは独立）。
 */
export const GRAPHQL_QUERY_PR_DETAIL = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number
      title
      state
      projectItems(first: 5) {
        nodes {
          id
          project { id title }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
          }
        }
      }
    }
  }
}
`;

export const GRAPHQL_QUERY_ISSUE_DETAIL = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      number
      title
      body
      url
      state
      issueType { name }
      createdAt
      updatedAt
      labels(first: 20) {
        nodes { name }
      }
      parent {
        id
        number
        title
      }
      subIssuesSummary {
        total
        completed
        percentCompleted
      }
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
// Types
// =============================================================================

export interface IssueDetail {
  projectItemId?: string;
  projectId?: string;
  status?: string;
  /** 親 Issue の情報。`parent.id` は `unparentFromOwnParent` で `removeSubIssue` mutation の
   *  `parentIssueId` に使う。親なしの場合は undefined。#2326 で id を含めるよう拡張。 */
  parent?: { id: string; number: number; title?: string };
}

export interface ResolvedProjectItem {
  projectId: string;
  projectItemId: string;
  fields: Record<string, ProjectField>;
  /** #1936 G12 後退クリアを `updateProjectStatus` 経由の全コマンドで有効化するため、`previousStatus` として渡す値を保持する。
   * @see ADR-v3-014 (#2151), REFACTOR-1 (#2154) */
  currentStatus?: string;
}

export type StatusUpdateReason =
  | "field-not-found"
  | "option-not-found"
  | "update-failed";

export type ResolutionFailReason =
  | "no-project"
  | "no-item"
  | "no-fields";

export type StatusUpdateSuccessReason = "already-at-target";

export type FullStatusUpdateReason =
  | StatusUpdateReason
  | ResolutionFailReason
  | StatusUpdateSuccessReason;

export interface UpdateProjectStatusResult {
  success: boolean;
  reason?: StatusUpdateReason;
}

export interface FullStatusUpdateResult {
  success: boolean;
  reason?: FullStatusUpdateReason;
}

// =============================================================================
// setFieldsWithStatusRouting - 非 Status フィールドと Status を一括設定するヘルパー
// =============================================================================

export interface SetFieldsWithStatusRoutingResult {
  fieldsUpdated: boolean;
  statusUpdated: boolean;
}

/**
 * 非 Status フィールドと Status を一括設定する共通ヘルパー。
 * Status は `autoSetTimestamps` を発動させるため `updateProjectStatus` 経由でルーティングする。
 * `projectFields` の GraphQL 呼び出しは内部で条件取得し、両経路で共有する。
 *
 * ADR-v3-014 FIX-3/4/5 の重複パターンを集約する (#2173)。
 *
 * GraphQL 節約:
 * - `statusValue` が truthy の場合のみ `getProjectFields` を呼び出す
 * - `nonStatusFields` が空かつ `statusValue` も空の場合は完全な no-op（GraphQL 0 回呼び出し）
 *
 * @param options.projectId - Project の GraphQL ID
 * @param options.itemId - Project Item の GraphQL ID
 * @param options.nonStatusFields - Status を除いた設定フィールド（Priority, Size 等）
 * @param options.statusValue - 設定する Status 値（undefined の場合は Status 更新をスキップ）
 * @param options.logger - ロガー
 * @param options.previousStatus - 遷移前のステータス（省略時はクリア処理をスキップ）
 * @returns `fieldsUpdated` / `statusUpdated` の更新フラグ。スキップまたは失敗時は false
 */
export async function setFieldsWithStatusRouting(options: {
  projectId: string;
  itemId: string;
  nonStatusFields: Record<string, string>;
  statusValue: string | undefined;
  logger: Logger;
  previousStatus?: string;
}): Promise<SetFieldsWithStatusRoutingResult> {
  const { projectId, itemId, nonStatusFields, statusValue, logger, previousStatus } = options;

  // `projectFields` は両経路で共有し GraphQL 呼び出しを 1 回に削減する。
  // Status がない場合は取得しない（getProjectFields の GraphQL を節約）。
  const projectFields = statusValue ? await getProjectFields(projectId) : undefined;

  let fieldsUpdated = false;
  if (Object.keys(nonStatusFields).length > 0) {
    const count = await setItemFields(projectId, itemId, nonStatusFields, logger, projectFields);
    fieldsUpdated = count > 0;
  }

  let statusUpdated = false;
  if (statusValue && projectFields) {
    const result = await updateProjectStatus({
      projectId,
      itemId,
      statusValue,
      projectFields,
      logger,
      previousStatus,
    });
    statusUpdated = result.success;
  }

  return { fieldsUpdated, statusUpdated };
}

// =============================================================================
// getIssueDetail - Issue の projectItemId と projectId を取得
// =============================================================================

/**
 * Issue の projectItemId と projectId を GraphQL で取得する
 */
export async function getIssueDetail(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<IssueDetail | null> {
  interface IssueNode {
    number?: number;
    parent?: { id?: string; number?: number; title?: string } | null;
    projectItems?: {
      nodes?: Array<{
        id?: string;
        project?: { id?: string; title?: string };
        status?: { name?: string } | null;
      }>;
    };
  }

  interface QueryResult {
    data?: {
      repository?: {
        issue?: IssueNode;
      };
    };
  }

  const result = await runGraphQL<QueryResult>(GRAPHQL_QUERY_ISSUE_DETAIL, {
    owner,
    name: repo,
    number: issueNumber,
  });

  if (!result.success) return null;
  const issue = result.data?.data?.repository?.issue;
  if (!issue) return null;

  // Match by project name convention, fallback to first item
  const projectItems = issue.projectItems?.nodes ?? [];
  const projectItem = projectItems.find((p) => p?.project?.title === repo) ?? projectItems[0];
  const parent = issue.parent && issue.parent.id && issue.parent.number !== undefined
    ? { id: issue.parent.id, number: issue.parent.number, title: issue.parent.title }
    : undefined;
  return {
    projectItemId: projectItem?.id,
    projectId: projectItem?.project?.id,
    status: projectItem?.status?.name,
    parent,
  };
}

// =============================================================================
// updateProjectStatus - 低レベル: projectId/itemId 既知の場合
// =============================================================================

/**
 * projectId/itemId が既知の場合に Status を更新する。
 * autoSetTimestamps も一貫して呼び出す。
 *
 * @param options.projectId - Project の GraphQL ID
 * @param options.itemId - Project Item の GraphQL ID
 * @param options.statusValue - 設定する Status 値
 * @param options.projectFields - キャッシュ済みフィールド定義
 * @param options.logger - ロガー
 * @param options.previousStatus - 遷移前のステータス（省略時はクリア処理をスキップ）
 *
 * 遷移バリデーションはこの関数では行わない（#2544: 二重バリデーション廃止）。
 * ロールバックガードは各 CLI 入口（status transition / pushIssueBody）で実施する。
 */
export async function updateProjectStatus(options: {
  projectId: string;
  itemId: string;
  statusValue: string;
  projectFields: Record<string, ProjectField>;
  logger: Logger;
  previousStatus?: string;
}): Promise<UpdateProjectStatusResult> {
  const { projectId, itemId, statusValue, projectFields, logger, previousStatus } = options;

  // updateProjectStatus は Status 更新の唯一の正規内部経路であり、
  // setItemFields の NonStatusFields 型制約を意図的に回避する。
  const count = await setItemFields(
    projectId,
    itemId,
    { Status: statusValue } as unknown as NonStatusFields,
    logger,
    projectFields
  );

  if (count > 0) {
    // 常に autoSetTimestamps を呼び出す（mapping なしなら silent skip）
    await autoSetTimestamps(projectId, itemId, statusValue, projectFields, logger, undefined, previousStatus);
    return { success: true };
  }

  return { success: false, reason: "update-failed" };
}

// =============================================================================
// resolveProjectItem - issueNumber → projectId/itemId/fields を一括取得
// =============================================================================

/**
 * Issue 番号から projectId, projectItemId, fields を解決する。
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param issueNumber - Issue 番号
 * @param logger - ロガー
 * @param projectName - プロジェクト名（省略時はリポジトリ名）
 */
export async function resolveProjectItem(
  owner: string,
  repo: string,
  issueNumber: number,
  logger: Logger,
  projectName?: string
): Promise<ResolvedProjectItem | null> {
  const projectId = await getProjectId(owner, projectName);
  if (!projectId) {
    logger.warn("No project found");
    return null;
  }

  const detail = await getIssueDetail(owner, repo, issueNumber);
  if (!detail?.projectItemId) {
    logger.warn(`Issue #${issueNumber}: not found in project`);
    return null;
  }

  const fields = await getProjectFields(projectId);
  return {
    projectId,
    projectItemId: detail.projectItemId,
    fields,
    currentStatus: detail.status,
  };
}

// =============================================================================
// resolveAndUpdateStatus - ファサード: issueNumber → Status 更新を一発で
// =============================================================================

/**
 * Issue 番号から Status を解決・更新する。
 * projectId/itemId 未知の場合のファサード。
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param issueNumber - Issue 番号
 * @param statusValue - 設定する Status 値
 * @param logger - ロガー
 * @param projectName - プロジェクト名（省略時はリポジトリ名）
 */
export async function resolveAndUpdateStatus(
  owner: string,
  repo: string,
  issueNumber: number,
  statusValue: string,
  logger: Logger,
  projectName?: string
): Promise<FullStatusUpdateResult> {
  const resolved = await resolveProjectItem(owner, repo, issueNumber, logger, projectName);
  if (!resolved) {
    return { success: false, reason: "no-item" };
  }

  if (resolved.currentStatus === statusValue) {
    return { success: true, reason: "already-at-target" };
  }

  const result = await updateProjectStatus({
    projectId: resolved.projectId,
    itemId: resolved.projectItemId,
    statusValue,
    projectFields: resolved.fields,
    logger,
    previousStatus: resolved.currentStatus,
  });

  // 成功かつ終了ステータスの場合は open-issues から除去
  if (result.success && CLOSE_STATUSES.includes(statusValue)) {
    removeOpenIssuesEntry(issueNumber, owner, repo);
  }

  return result;
}

// =============================================================================
// getPrDetail - PR の projectItemId と projectId を取得
// =============================================================================

/**
 * PR の projectItemId, projectId, status を GraphQL で取得する。
 * `getIssueDetail` の PR 版。Issue とは独立した関数（既存の Issue 専用関数を変更しない）。
 */
export async function getPrDetail(
  owner: string,
  repo: string,
  prNumber: number
): Promise<IssueDetail | null> {
  interface PrNode {
    number?: number;
    projectItems?: {
      nodes?: Array<{
        id?: string;
        project?: { id?: string; title?: string };
        status?: { name?: string } | null;
      }>;
    };
  }

  interface QueryResult {
    data?: {
      repository?: {
        pullRequest?: PrNode;
      };
    };
  }

  const result = await runGraphQL<QueryResult>(GRAPHQL_QUERY_PR_DETAIL, {
    owner,
    name: repo,
    number: prNumber,
  });

  if (!result.success) return null;
  const pr = result.data?.data?.repository?.pullRequest;
  if (!pr) return null;

  // リポジトリ名に一致するプロジェクトを優先、なければ最初のアイテムを使用
  const projectItems = pr.projectItems?.nodes ?? [];
  const projectItem = projectItems.find((p) => p?.project?.title === repo) ?? projectItems[0];
  return {
    projectItemId: projectItem?.id,
    projectId: projectItem?.project?.id,
    status: projectItem?.status?.name,
  };
}

// =============================================================================
// resolvePrProjectItem - prNumber → projectId/itemId/fields を一括取得
// =============================================================================

/**
 * PR 番号から projectId, projectItemId, fields を解決する。
 * `resolveProjectItem` の PR 版。
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param prNumber - PR 番号
 * @param logger - ロガー
 * @param projectName - プロジェクト名（省略時はリポジトリ名）
 */
export async function resolvePrProjectItem(
  owner: string,
  repo: string,
  prNumber: number,
  logger: Logger,
  projectName?: string
): Promise<ResolvedProjectItem | null> {
  const projectId = await getProjectId(owner, projectName);
  if (!projectId) {
    logger.warn("No project found");
    return null;
  }

  const detail = await getPrDetail(owner, repo, prNumber);
  if (!detail?.projectItemId) {
    logger.warn(`PR #${prNumber}: not found in project`);
    return null;
  }

  const fields = await getProjectFields(projectId);
  return {
    projectId,
    projectItemId: detail.projectItemId,
    fields,
    currentStatus: detail.status,
  };
}

// =============================================================================
// resolvePrAndUpdateStatus - ファサード: prNumber → Status 更新を一発で
// =============================================================================

/**
 * PR 番号から Status を解決・更新する。
 * `resolveAndUpdateStatus` の PR 版。PR 専用の追加関数（Issue 専用関数は変更しない）。
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param prNumber - PR 番号
 * @param statusValue - 設定する Status 値
 * @param logger - ロガー
 * @param projectName - プロジェクト名（省略時はリポジトリ名）
 */
export async function resolvePrAndUpdateStatus(
  owner: string,
  repo: string,
  prNumber: number,
  statusValue: string,
  logger: Logger,
  projectName?: string
): Promise<FullStatusUpdateResult> {
  const resolved = await resolvePrProjectItem(owner, repo, prNumber, logger, projectName);
  if (!resolved) {
    return { success: false, reason: "no-item" };
  }

  if (resolved.currentStatus === statusValue) {
    return { success: true, reason: "already-at-target" };
  }

  const result = await updateProjectStatus({
    projectId: resolved.projectId,
    itemId: resolved.projectItemId,
    statusValue,
    projectFields: resolved.fields,
    logger,
    previousStatus: resolved.currentStatus,
  });

  return result;
}
