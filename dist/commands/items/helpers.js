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
import { runGraphQL, } from "../../utils/github.js";
import { getOctokit } from "../../utils/octokit-client.js";
// =============================================================================
// GraphQL Queries
// =============================================================================
const GRAPHQL_QUERY_ISSUE_ID = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id
    }
  }
}
`;
const GRAPHQL_QUERY_PR_ID = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      id
    }
  }
}
`;
const GRAPHQL_QUERY_LABELS = `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    labels(first: 50) {
      nodes { id name }
    }
  }
}
`;
const GRAPHQL_QUERY_ORGANIZATION_ISSUE_TYPES = `
query($login: String!) {
  organization(login: $login) {
    issueTypes(first: 50) {
      nodes { id name }
    }
  }
}
`;
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * カンマ区切りのラベル名を個別のラベル名に正規化する。
 * 例: ["area:cli,area:plugin", "area:docs"] → ["area:cli", "area:plugin", "area:docs"]
 */
export function normalizeLabels(labels) {
    return labels.flatMap((l) => l.split(",").map((s) => s.trim())).filter(Boolean);
}
/**
 * Build GraphQL mutation variables for updateIssue.
 * When issueType is not specified, omit issueTypeId to preserve existing Type.
 */
export function buildUpdateIssueVariables(params) {
    const vars = {
        id: params.issueId,
        title: params.title,
        body: params.body,
    };
    if (params.issueType) {
        vars.issueTypeId = params.issueTypeId ?? null;
    }
    return vars;
}
/**
 * Issue GraphQL ID を番号から取得する。
 */
export async function getIssueId(owner, repo, number) {
    const result = await runGraphQL(GRAPHQL_QUERY_ISSUE_ID, { owner, name: repo, number });
    if (!result.success)
        return null;
    return result.data?.data?.repository?.issue?.id ?? null;
}
/**
 * PR GraphQL ID を番号から取得する。
 */
export async function getPullRequestId(owner, repo, number) {
    const result = await runGraphQL(GRAPHQL_QUERY_PR_ID, { owner, name: repo, number });
    if (!result.success)
        return null;
    return result.data?.data?.repository?.pullRequest?.id ?? null;
}
/**
 * リポジトリラベル一覧を名前→ID マッピングで返す。
 */
export async function getLabels(owner, repo) {
    const result = await runGraphQL(GRAPHQL_QUERY_LABELS, { owner, name: repo });
    if (!result.success)
        return {};
    const labels = {};
    const nodes = result.data?.data?.repository?.labels?.nodes ?? [];
    for (const node of nodes) {
        if (node?.name && node?.id) {
            labels[node.name] = node.id;
        }
    }
    return labels;
}
/**
 * 組織の Issue Types 一覧を取得し、名前→ID マッピングを返す。
 */
export async function getOrganizationIssueTypes(owner) {
    const result = await runGraphQL(GRAPHQL_QUERY_ORGANIZATION_ISSUE_TYPES, { login: owner });
    if (!result.success)
        return {};
    const types = {};
    const nodes = result.data?.data?.organization?.issueTypes?.nodes ?? [];
    for (const node of nodes) {
        if (node?.name && node?.id) {
            types[node.name] = node.id;
        }
    }
    return types;
}
/**
 * Issue Type 名を ID に解決する。
 * 解決成功時は ID 文字列、スキップ時は null、エラー時は false を返す。
 */
export async function resolveIssueTypeId(owner, typeName, logger) {
    const issueTypes = await getOrganizationIssueTypes(owner);
    const id = issueTypes[typeName] ?? null;
    if (id)
        return id;
    const available = Object.keys(issueTypes);
    if (available.length === 0) {
        logger.error(`Issue Types not available for organization '${owner}'. ` +
            `--issue-type requires an organization with Issue Types enabled.`);
        return false;
    }
    logger.error(`Issue Type '${typeName}' not found. Available: ${available.join(", ")}`);
    return false;
}
// =============================================================================
// Sub-Issues API 定数
// =============================================================================
/** GraphQL-Features ヘッダー: Sub-Issues API へのアクセスに必要 */
export const SUB_ISSUES_GRAPHQL_HEADERS = {
    "GraphQL-Features": "sub_issues",
};
export const GRAPHQL_QUERY_SUB_ISSUES = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      number
      title
      subIssues(first: 50) {
        totalCount
        nodes {
          number
          title
          url
          state
          labels(first: 10) {
            nodes { name }
          }
          projectItems(first: 5) {
            nodes {
              id
              project { title }
              status: fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
              priority: fieldValueByName(name: "Priority") {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
              size: fieldValueByName(name: "Size") {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
            }
          }
        }
      }
      subIssuesSummary {
        total
        completed
        percentCompleted
      }
    }
  }
}
`;
/**
 * Issue 番号から GitHub 内部 ID（REST API の id フィールド）を取得する。
 * Sub-Issues REST API の sub_issue_id パラメータに必要。
 */
export async function getIssueInternalId(owner, repo, issueNumber, _options) {
    try {
        const octokit = getOctokit();
        const { data } = await octokit.rest.issues.get({
            owner,
            repo,
            issue_number: issueNumber,
        });
        return data.id ?? null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=helpers.js.map