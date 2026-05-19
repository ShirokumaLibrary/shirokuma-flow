/**
 * 共有 GraphQL クエリ・ミューテーション定義 + ヘルパー関数
 *
 * 複数のコマンドファイルで使用される共通クエリとユーティリティを集約。
 * 各コマンド固有のクエリは各ファイルに残す。
 *
 * 利用元: issues.ts, projects.ts, discussions.ts, session.ts, repo.ts, issues-pr.ts
 */
/** リポジトリ ID を取得 */
export declare const GRAPHQL_QUERY_REPO_ID = "\nquery($owner: String!, $name: String!) {\n  repository(owner: $owner, name: $name) {\n    id\n  }\n}\n";
/** Discussion を作成 */
export declare const GRAPHQL_MUTATION_CREATE_DISCUSSION = "\nmutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {\n  createDiscussion(input: {repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body}) {\n    discussion {\n      id\n      number\n      url\n      title\n    }\n  }\n}\n";
/** Project アイテムを削除 */
export declare const GRAPHQL_MUTATION_DELETE_ITEM = "\nmutation($projectId: ID!, $itemId: ID!) {\n  deleteProjectV2Item(input: {projectId: $projectId, itemId: $itemId}) {\n    deletedItemId\n  }\n}\n";
/** Issue をクローズ */
export declare const GRAPHQL_MUTATION_CLOSE_ISSUE = "\nmutation($issueId: ID!, $stateReason: IssueClosedStateReason) {\n  closeIssue(input: {issueId: $issueId, stateReason: $stateReason}) {\n    issue { id number state }\n  }\n}\n";
/** Issue/PR にコメントを追加 */
export declare const GRAPHQL_MUTATION_ADD_COMMENT = "\nmutation($subjectId: ID!, $body: String!) {\n  addComment(input: {subjectId: $subjectId, body: $body}) {\n    commentEdge {\n      node { id databaseId url }\n    }\n  }\n}\n";
/** GRAPHQL_MUTATION_ADD_COMMENT のレスポンス型 */
export interface AddCommentResult {
    data?: {
        addComment?: {
            commentEdge?: {
                node?: {
                    id?: string;
                    databaseId?: number;
                    url?: string;
                };
            };
        };
    };
}
/** Issue を作成 */
export declare const GRAPHQL_MUTATION_CREATE_ISSUE = "\nmutation($repositoryId: ID!, $title: String!, $body: String, $labelIds: [ID!], $issueTypeId: ID) {\n  createIssue(input: {repositoryId: $repositoryId, title: $title, body: $body, labelIds: $labelIds, issueTypeId: $issueTypeId}) {\n    issue { id number url title }\n  }\n}\n";
/** Issue をリオープン */
export declare const GRAPHQL_MUTATION_REOPEN_ISSUE = "\nmutation($issueId: ID!) {\n  reopenIssue(input: {issueId: $issueId}) {\n    issue { id number state }\n  }\n}\n";
/** ラベルを作成 */
export declare const GRAPHQL_MUTATION_CREATE_LABEL = "\nmutation($repositoryId: ID!, $name: String!, $color: String!, $description: String) {\n  createLabel(input: {repositoryId: $repositoryId, name: $name, color: $color, description: $description}) {\n    label {\n      id\n      name\n      color\n      description\n    }\n  }\n}\n";
/** リポジトリの GraphQL ID を取得 */
export declare function getRepoId(owner: string, repo: string): Promise<string | null>;
//# sourceMappingURL=graphql-queries.d.ts.map