/**
 * items pull - Issue 取得・キャッシュ書き込み (#1808)
 *
 * @related push/issue.ts - Issue 本体の push ロジック
 * @related add/issue.ts - Issue 作成ロジック
 */
import type { Logger } from "../../../utils/logger.js";
import type { RemoteItemSnapshot } from "../types.js";
/**
 * Issue 詳細取得（Projects フィールド付き）
 * GRAPHQL_QUERY_ISSUE_DETAIL をベースに items 用に拡張
 */
export declare const GRAPHQL_QUERY_ISSUE_WITH_FIELDS = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    issue(number: $number) {\n      number\n      title\n      body\n      url\n      state\n      updatedAt\n      labels(first: 20) {\n        nodes { name }\n      }\n      assignees(first: 10) {\n        nodes { login }\n      }\n      projectItems(first: 5) {\n        nodes {\n          id\n          project { id title }\n          status: fieldValueByName(name: \"Status\") {\n            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }\n          }\n          priority: fieldValueByName(name: \"Priority\") {\n            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }\n          }\n          size: fieldValueByName(name: \"Size\") {\n            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }\n          }\n        }\n      }\n      parent {\n        number\n        title\n      }\n      subIssuesSummary {\n        total\n        completed\n        percentCompleted\n      }\n    }\n  }\n}\n";
/** Issue コメント取得（first: 100） */
export declare const GRAPHQL_QUERY_ISSUE_COMMENTS = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    issue(number: $number) {\n      comments(first: 100) {\n        totalCount\n        nodes {\n          id\n          databaseId\n          author { login }\n          body\n          createdAt\n          updatedAt\n          url\n        }\n      }\n    }\n  }\n}\n";
export interface IssueNode {
    number?: number;
    title?: string;
    body?: string;
    url?: string;
    state?: string;
    updatedAt?: string;
    labels?: {
        nodes?: Array<{
            name?: string;
        }>;
    };
    assignees?: {
        nodes?: Array<{
            login?: string;
        }>;
    };
    projectItems?: {
        nodes?: Array<{
            id?: string;
            project?: {
                id?: string;
                title?: string;
            };
            status?: {
                name?: string;
                optionId?: string;
            };
            priority?: {
                name?: string;
                optionId?: string;
            };
            size?: {
                name?: string;
                optionId?: string;
            };
        }>;
    };
    parent?: {
        number?: number;
        title?: string;
    };
    subIssuesSummary?: {
        total?: number;
        completed?: number;
        percentCompleted?: number;
    };
}
export interface IssueQueryResult {
    data?: {
        repository?: {
            issue?: IssueNode;
        };
    };
}
export interface ResolvedProjectFields {
    status?: string;
    priority?: string;
    size?: string;
    labels: string[];
    assignees: string[];
}
/**
 * Issue ノードから Projects フィールド（status/priority/size）とラベル・担当者を解決する。
 * fetchAndCacheIssue と fetchRemoteIssueSnapshot の共通ロジック。
 */
export declare function resolveIssueProjectFields(node: IssueNode, owner: string, repo: string): Promise<ResolvedProjectFields>;
/**
 * Issue 本体 + コメントを取得してキャッシュに書き込む。
 * `RemoteItemSnapshot` を返す（check コマンドとの共有用）。
 */
export declare function fetchAndCacheIssue(owner: string, repo: string, number: number, org: string, baseDir?: string, logger?: Logger): Promise<RemoteItemSnapshot | null>;
//# sourceMappingURL=issue.d.ts.map