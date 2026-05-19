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
import { getProjectFields, setItemFields, autoSetTimestamps, } from "./project-fields.js";
import { getProjectId } from "./project-utils.js";
import { removeOpenIssuesEntry } from "./github-cache.js";
import { STATUS_VALUES } from "./status-workflow.js";
/** open-issues インデックスから除去対象となる終了ステータス。
 * TERMINAL_STATUSES（status-workflow.ts）とは用途が異なる:
 * - Cancelled は items cancel が直接 removeOpenIssuesEntry を呼ぶため除外
 * - Completed は PR マージ後の中間ステータスだがインデックスからは除去する */
const CLOSE_STATUSES = [STATUS_VALUES.DONE, STATUS_VALUES.COMPLETED];
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
export async function setFieldsWithStatusRouting(options) {
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
export async function getIssueDetail(owner, repo, issueNumber) {
    const result = await runGraphQL(GRAPHQL_QUERY_ISSUE_DETAIL, {
        owner,
        name: repo,
        number: issueNumber,
    });
    if (!result.success)
        return null;
    const issue = result.data?.data?.repository?.issue;
    if (!issue)
        return null;
    // Match by project name convention, fallback to first item
    const projectItems = issue.projectItems?.nodes ?? [];
    const projectItem = projectItems.find((p) => p?.project?.title === repo) ?? projectItems[0];
    return {
        projectItemId: projectItem?.id,
        projectId: projectItem?.project?.id,
        status: projectItem?.status?.name,
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
 * @param options.force - 遷移バリデーションを強制バイパスする（--force オプション）
 */
export async function updateProjectStatus(options) {
    const { projectId, itemId, statusValue, projectFields, logger, previousStatus, force } = options;
    // updateProjectStatus は Status 更新の唯一の正規内部経路であり、
    // setItemFields の NonStatusFields 型制約を意図的に回避する。
    const count = await setItemFields(projectId, itemId, { Status: statusValue }, logger, projectFields, previousStatus, force);
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
export async function resolveProjectItem(owner, repo, issueNumber, logger, projectName) {
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
export async function resolveAndUpdateStatus(owner, repo, issueNumber, statusValue, logger, projectName) {
    const resolved = await resolveProjectItem(owner, repo, issueNumber, logger, projectName);
    if (!resolved) {
        return { success: false, reason: "no-item" };
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
export async function getPrDetail(owner, repo, prNumber) {
    const result = await runGraphQL(GRAPHQL_QUERY_PR_DETAIL, {
        owner,
        name: repo,
        number: prNumber,
    });
    if (!result.success)
        return null;
    const pr = result.data?.data?.repository?.pullRequest;
    if (!pr)
        return null;
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
export async function resolvePrProjectItem(owner, repo, prNumber, logger, projectName) {
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
export async function resolvePrAndUpdateStatus(owner, repo, prNumber, statusValue, logger, projectName) {
    const resolved = await resolvePrProjectItem(owner, repo, prNumber, logger, projectName);
    if (!resolved) {
        return { success: false, reason: "no-item" };
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
//# sourceMappingURL=issue-detail.js.map