/**
 * Issue / PR のステータス解決ヘルパー
 *
 * `status get` / `status allowed` / `status transition` で共通利用する。
 * キャッシュ優先 → GraphQL → PR フォールバックの順で現在ステータスを取得する。
 */
import { runGraphQL } from "../../../utils/github.js";
import { getPrDetail } from "../../../utils/issue-detail.js";
import { readContextCache } from "../../../utils/context-cache.js";
const GRAPHQL_QUERY_ISSUE_STATUS = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id
      state
      projectItems(first: 5) {
        nodes {
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
        }
      }
    }
  }
}
`;
/**
 * キャッシュ → GraphQL → PR フォールバックの順で現在のステータスを取得する。
 *
 * @returns ステータス値、PR 経由かどうか、キャッシュヒットかどうかを含む結果
 */
export async function resolveCurrentStatus(owner, repo, number, logger) {
    const cached = readContextCache("issues", String(number));
    if (cached?.status) {
        logger.info(`Issue #${number} のステータスをキャッシュから取得: ${cached.status}`);
        return { status: cached.status, isPr: false, fromCache: true };
    }
    const issueResult = await runGraphQL(GRAPHQL_QUERY_ISSUE_STATUS, { owner, name: repo, number });
    if (issueResult.success) {
        const issueData = issueResult.data?.data?.repository?.issue;
        if (issueData) {
            const nodes = issueData.projectItems?.nodes ?? [];
            for (const node of nodes) {
                if (node.status?.name) {
                    return { status: node.status.name, isPr: false, fromCache: false };
                }
            }
            return { status: null, isPr: false, fromCache: false };
        }
    }
    const prDetail = await getPrDetail(owner, repo, number);
    if (prDetail) {
        return { status: prDetail.status ?? null, isPr: true, fromCache: false };
    }
    return { status: null, isPr: false, fromCache: false };
}
//# sourceMappingURL=resolve-status.js.map