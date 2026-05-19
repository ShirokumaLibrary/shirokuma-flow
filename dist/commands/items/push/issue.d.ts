/**
 * items push - Issue 本体の push ロジック (#1808, #1810)
 *
 * @related pull/issue.ts - Issue 取得・キャッシュ書き込み
 * @related add/issue.ts - Issue 作成ロジック
 */
import type { Logger } from "../../../utils/logger.js";
import type { CacheMetadata } from "../../../utils/github-cache.js";
import type { PushOptions } from "../types.js";
export declare const GRAPHQL_MUTATION_UPDATE_ISSUE = "\nmutation($id: ID!, $title: String, $body: String, $issueTypeId: ID) {\n  updateIssue(input: {id: $id, title: $title, body: $body, issueTypeId: $issueTypeId}) {\n    issue { id number title body updatedAt issueType { id name } }\n  }\n}\n";
export declare const GRAPHQL_MUTATION_ADD_LABELS = "\nmutation($labelableId: ID!, $labelIds: [ID!]!) {\n  addLabelsToLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {\n    labelable { ... on Issue { id number labels(first: 20) { nodes { name } } } }\n  }\n}\n";
export declare const GRAPHQL_MUTATION_REMOVE_LABELS = "\nmutation($labelableId: ID!, $labelIds: [ID!]!) {\n  removeLabelsFromLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {\n    labelable { ... on Issue { id number labels(first: 20) { nodes { name } } } }\n  }\n}\n";
/** Issue の GraphQL ID + 本文 + Projects フィールド + ラベル + 担当者を一括取得 */
export declare const GRAPHQL_QUERY_ISSUE_FOR_PUSH = "\nquery($owner: String!, $name: String!, $number: Int!) {\n  repository(owner: $owner, name: $name) {\n    issue(number: $number) {\n      id\n      title\n      body\n      state\n      updatedAt\n      issueType { id name }\n      labels(first: 20) { nodes { name } }\n      assignees(first: 10) { nodes { login } }\n      projectItems(first: 5) {\n        nodes {\n          id\n          project { id title }\n          status: fieldValueByName(name: \"Status\") {\n            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }\n          }\n          priority: fieldValueByName(name: \"Priority\") {\n            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }\n          }\n          size: fieldValueByName(name: \"Size\") {\n            ... on ProjectV2ItemFieldSingleSelectValue { name optionId }\n          }\n        }\n      }\n    }\n  }\n}\n";
/** ローカルとリモートの配列差分を計算する */
export declare function computeArrayDiff(local: string[] | null, remote: string[]): {
    toAdd: string[];
    toRemove: string[];
};
/** Issue 本体を push */
export declare function pushIssueBody(owner: string, repo: string, number: number, localBody: string, localMeta: CacheMetadata, options: PushOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=issue.d.ts.map