/**
 * 共有 GraphQL クエリ・ミューテーション定義 + ヘルパー関数
 *
 * 複数のコマンドファイルで使用される共通クエリとユーティリティを集約。
 * 各コマンド固有のクエリは各ファイルに残す。
 *
 * 利用元: issues.ts, projects.ts, discussions.ts, session.ts, repo.ts, issues-pr.ts
 */
import { runGraphQL } from "./github.js";
/** リポジトリ ID を取得 */
export const GRAPHQL_QUERY_REPO_ID = `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    id
  }
}
`;
/** Discussion を作成 */
export const GRAPHQL_MUTATION_CREATE_DISCUSSION = `
mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
  createDiscussion(input: {repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body}) {
    discussion {
      id
      number
      url
      title
    }
  }
}
`;
/** Project アイテムを削除 */
export const GRAPHQL_MUTATION_DELETE_ITEM = `
mutation($projectId: ID!, $itemId: ID!) {
  deleteProjectV2Item(input: {projectId: $projectId, itemId: $itemId}) {
    deletedItemId
  }
}
`;
/** Issue をクローズ */
export const GRAPHQL_MUTATION_CLOSE_ISSUE = `
mutation($issueId: ID!, $stateReason: IssueClosedStateReason) {
  closeIssue(input: {issueId: $issueId, stateReason: $stateReason}) {
    issue { id number state }
  }
}
`;
/** Issue/PR にコメントを追加 */
export const GRAPHQL_MUTATION_ADD_COMMENT = `
mutation($subjectId: ID!, $body: String!) {
  addComment(input: {subjectId: $subjectId, body: $body}) {
    commentEdge {
      node { id databaseId url }
    }
  }
}
`;
/** Issue を作成 */
export const GRAPHQL_MUTATION_CREATE_ISSUE = `
mutation($repositoryId: ID!, $title: String!, $body: String, $labelIds: [ID!], $issueTypeId: ID) {
  createIssue(input: {repositoryId: $repositoryId, title: $title, body: $body, labelIds: $labelIds, issueTypeId: $issueTypeId}) {
    issue { id number url title }
  }
}
`;
/** Issue をリオープン */
export const GRAPHQL_MUTATION_REOPEN_ISSUE = `
mutation($issueId: ID!) {
  reopenIssue(input: {issueId: $issueId}) {
    issue { id number state }
  }
}
`;
/** ラベルを作成 */
export const GRAPHQL_MUTATION_CREATE_LABEL = `
mutation($repositoryId: ID!, $name: String!, $color: String!, $description: String) {
  createLabel(input: {repositoryId: $repositoryId, name: $name, color: $color, description: $description}) {
    label {
      id
      name
      color
      description
    }
  }
}
`;
// =============================================================================
// ヘルパー関数
// =============================================================================
/** リポジトリの GraphQL ID を取得 */
export async function getRepoId(owner, repo) {
    const result = await runGraphQL(GRAPHQL_QUERY_REPO_ID, {
        owner,
        name: repo,
    });
    if (!result.success)
        return null;
    return result.data?.data?.repository?.id ?? null;
}
//# sourceMappingURL=graphql-queries.js.map