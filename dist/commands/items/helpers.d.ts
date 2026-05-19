/**
 * items コマンド共有ヘルパー関数 (#1814)
 *
 * issues/helpers.ts から移行。session・items 配下の各コマンドが参照する。
 *
 * エクスポート:
 * - getIssueId: Issue GraphQL ID を番号から取得
 * - getPullRequestId: PR GraphQL ID を番号から取得
 * - getOrganizationIssueTypes: 組織 Issue Types 名→ID マッピング取得
 * - buildUpdateIssueVariables: updateIssue GraphQL mutation 変数を組み立て
 * - getLabels: リポジトリラベル 名→ID マッピング取得
 * - normalizeLabels: カンマ区切りラベル配列を正規化
 * - resolveIssueTypeId: Issue Type 名を ID に解決
 * - getIssueInternalId: Issue REST API internal ID を取得（Sub-Issues API 向け）
 */
import { GhVariableValue } from "../../utils/github.js";
import type { Logger } from "../../utils/logger.js";
/**
 * カンマ区切りのラベル名を個別のラベル名に正規化する。
 * 例: ["area:cli,area:plugin", "area:docs"] → ["area:cli", "area:plugin", "area:docs"]
 */
export declare function normalizeLabels(labels: string[]): string[];
/**
 * Build GraphQL mutation variables for updateIssue.
 * When issueType is not specified, omit issueTypeId to preserve existing Type.
 */
export declare function buildUpdateIssueVariables(params: {
    issueId: string;
    title: string;
    body: string;
    issueType?: string;
    issueTypeId?: string | null;
}): Record<string, GhVariableValue>;
/**
 * Issue GraphQL ID を番号から取得する。
 */
export declare function getIssueId(owner: string, repo: string, number: number): Promise<string | null>;
/**
 * PR GraphQL ID を番号から取得する。
 */
export declare function getPullRequestId(owner: string, repo: string, number: number): Promise<string | null>;
/**
 * リポジトリラベル一覧を名前→ID マッピングで返す。
 */
export declare function getLabels(owner: string, repo: string): Promise<Record<string, string>>;
/**
 * 組織の Issue Types 一覧を取得し、名前→ID マッピングを返す。
 */
export declare function getOrganizationIssueTypes(owner: string): Promise<Record<string, string>>;
/**
 * Issue Type 名を ID に解決する。
 * 解決成功時は ID 文字列、スキップ時は null、エラー時は false を返す。
 */
export declare function resolveIssueTypeId(owner: string, typeName: string, logger: Logger): Promise<string | null | false>;
/** GraphQL-Features ヘッダー: Sub-Issues API へのアクセスに必要 */
export declare const SUB_ISSUES_GRAPHQL_HEADERS: {
    "GraphQL-Features": string;
};
export declare const GRAPHQL_QUERY_SUB_ISSUES = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    issue(number: $number) {\n      number\n      title\n      subIssues(first: 50) {\n        totalCount\n        nodes {\n          number\n          title\n          url\n          state\n          labels(first: 10) {\n            nodes { name }\n          }\n          projectItems(first: 5) {\n            nodes {\n              id\n              project { title }\n              status: fieldValueByName(name: \"Status\") {\n                ... on ProjectV2ItemFieldSingleSelectValue { name }\n              }\n              priority: fieldValueByName(name: \"Priority\") {\n                ... on ProjectV2ItemFieldSingleSelectValue { name }\n              }\n              size: fieldValueByName(name: \"Size\") {\n                ... on ProjectV2ItemFieldSingleSelectValue { name }\n              }\n            }\n          }\n        }\n      }\n      subIssuesSummary {\n        total\n        completed\n        percentCompleted\n      }\n    }\n  }\n}\n";
/**
 * Issue 番号から GitHub 内部 ID（REST API の id フィールド）を取得する。
 * Sub-Issues REST API の sub_issue_id パラメータに必要。
 */
export declare function getIssueInternalId(owner: string, repo: string, issueNumber: number, _options?: {
    silent?: boolean;
}): Promise<number | null>;
//# sourceMappingURL=helpers.d.ts.map