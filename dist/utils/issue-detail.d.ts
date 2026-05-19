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
import { Logger } from "./logger.js";
import { type ProjectField } from "./project-fields.js";
/**
 * PR の projectItemId, projectId, status を GraphQL で取得するクエリ。
 * `repository.pullRequest(number:$number)` を使用する（Issue クエリとは独立）。
 */
export declare const GRAPHQL_QUERY_PR_DETAIL = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    pullRequest(number: $number) {\n      number\n      title\n      state\n      projectItems(first: 5) {\n        nodes {\n          id\n          project { id title }\n          status: fieldValueByName(name: \"Status\") {\n            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }\n          }\n        }\n      }\n    }\n  }\n}\n";
export declare const GRAPHQL_QUERY_ISSUE_DETAIL = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    issue(number: $number) {\n      number\n      title\n      body\n      url\n      state\n      issueType { name }\n      createdAt\n      updatedAt\n      labels(first: 20) {\n        nodes { name }\n      }\n      parent {\n        number\n        title\n      }\n      subIssuesSummary {\n        total\n        completed\n        percentCompleted\n      }\n      projectItems(first: 5) {\n        nodes {\n          id\n          project { id title }\n          status: fieldValueByName(name: \"Status\") {\n            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }\n          }\n          priority: fieldValueByName(name: \"Priority\") {\n            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }\n          }\n          size: fieldValueByName(name: \"Size\") {\n            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }\n          }\n        }\n      }\n    }\n  }\n}\n";
export interface IssueDetail {
    projectItemId?: string;
    projectId?: string;
    status?: string;
}
export interface ResolvedProjectItem {
    projectId: string;
    projectItemId: string;
    fields: Record<string, ProjectField>;
    /** #1936 G12 後退クリアを `updateProjectStatus` 経由の全コマンドで有効化するため、`previousStatus` として渡す値を保持する。
     * @see ADR-v3-014 (#2151), REFACTOR-1 (#2154) */
    currentStatus?: string;
}
export type StatusUpdateReason = "field-not-found" | "option-not-found" | "update-failed";
export type ResolutionFailReason = "no-project" | "no-item" | "no-fields";
export type FullStatusUpdateReason = StatusUpdateReason | ResolutionFailReason;
export interface UpdateProjectStatusResult {
    success: boolean;
    reason?: StatusUpdateReason;
}
export interface FullStatusUpdateResult {
    success: boolean;
    reason?: FullStatusUpdateReason;
}
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
export declare function setFieldsWithStatusRouting(options: {
    projectId: string;
    itemId: string;
    nonStatusFields: Record<string, string>;
    statusValue: string | undefined;
    logger: Logger;
    previousStatus?: string;
}): Promise<SetFieldsWithStatusRoutingResult>;
/**
 * Issue の projectItemId と projectId を GraphQL で取得する
 */
export declare function getIssueDetail(owner: string, repo: string, issueNumber: number): Promise<IssueDetail | null>;
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
export declare function updateProjectStatus(options: {
    projectId: string;
    itemId: string;
    statusValue: string;
    projectFields: Record<string, ProjectField>;
    logger: Logger;
    previousStatus?: string;
    force?: boolean;
}): Promise<UpdateProjectStatusResult>;
/**
 * Issue 番号から projectId, projectItemId, fields を解決する。
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param issueNumber - Issue 番号
 * @param logger - ロガー
 * @param projectName - プロジェクト名（省略時はリポジトリ名）
 */
export declare function resolveProjectItem(owner: string, repo: string, issueNumber: number, logger: Logger, projectName?: string): Promise<ResolvedProjectItem | null>;
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
export declare function resolveAndUpdateStatus(owner: string, repo: string, issueNumber: number, statusValue: string, logger: Logger, projectName?: string): Promise<FullStatusUpdateResult>;
/**
 * PR の projectItemId, projectId, status を GraphQL で取得する。
 * `getIssueDetail` の PR 版。Issue とは独立した関数（既存の Issue 専用関数を変更しない）。
 */
export declare function getPrDetail(owner: string, repo: string, prNumber: number): Promise<IssueDetail | null>;
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
export declare function resolvePrProjectItem(owner: string, repo: string, prNumber: number, logger: Logger, projectName?: string): Promise<ResolvedProjectItem | null>;
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
export declare function resolvePrAndUpdateStatus(owner: string, repo: string, prNumber: number, statusValue: string, logger: Logger, projectName?: string): Promise<FullStatusUpdateResult>;
//# sourceMappingURL=issue-detail.d.ts.map