/**
 * Issue / PR のステータス解決ヘルパー
 *
 * `status get` / `status allowed` / `status transition` で共通利用する。
 *
 * ADR-v3-025: 読み取りは常に API 直取得（GraphQL → PR フォールバック）。
 * `context-cache` (JSON) を読み取りショートカットに使うロジックは廃止された。
 */

import { runGraphQL } from "../../../utils/github.js";
import { getPrDetail } from "../../../utils/issue-detail.js";
import type { Logger } from "../../../utils/logger.js";

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

interface IssueStatusQueryResult {
  data?: {
    repository?: {
      issue?: {
        id?: string;
        state?: string;
        projectItems?: {
          nodes?: Array<{
            status?: { name?: string } | null;
          }>;
        };
      };
    };
  };
}

export interface ResolvedStatus {
  status: string | null;
  isPr: boolean;
  /**
   * ADR-v3-025 以降は常に false。フィールド自体は呼び出し元の型互換のため残しているが、
   * キャッシュヒット経路は廃止されている。
   */
  fromCache: boolean;
}

/**
 * GraphQL → PR フォールバックの順で現在のステータスを取得する。
 *
 * ADR-v3-025: 読み取りは常に API 直取得。キャッシュ優先読み取りは廃止された。
 *
 * @returns ステータス値と PR 経由かどうかを含む結果
 */
export async function resolveCurrentStatus(
  owner: string,
  repo: string,
  number: number,
  logger: Logger,
): Promise<ResolvedStatus> {
  // 引数を未使用扱いから外す（将来のログ/メトリクス用に保持）
  void logger;

  const issueResult = await runGraphQL<IssueStatusQueryResult>(
    GRAPHQL_QUERY_ISSUE_STATUS,
    { owner, name: repo, number },
  );

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
