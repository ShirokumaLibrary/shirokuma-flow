/**
 * Issue / PR のステータス解決ヘルパー
 *
 * `status get` / `status allowed` / `status transition` で共通利用する。
 * キャッシュ優先 → GraphQL → PR フォールバックの順で現在ステータスを取得する。
 */

import { runGraphQL } from "../../../utils/github.js";
import { getPrDetail } from "../../../utils/issue-detail.js";
import { readContextCache, writeContextCache } from "../../../utils/context-cache.js";
import type { Logger } from "../../../utils/logger.js";
import type { ContextTarget } from "../../issue/context/index.js";

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
  fromCache: boolean;
}

/** resolveCurrentStatus のオプション */
export interface ResolveStatusOptions {
  /**
   * キャッシュの status を信頼せずライブ（GraphQL → PR フォールバック）から再取得する。
   * 外部（GitHub UI・他マシン・別ツール）で Status が変わってキャッシュが stale に
   * なった場合に古い値で誤判定するのを防ぐ。ライブ取得に成功し非 null の status が
   * 得られた場合のみ、既存キャッシュの他フィールド（body/title/labels/assignees）を
   * 保持したまま status を書き戻す。
   */
  refresh?: boolean;
}

/**
 * キャッシュ → GraphQL → PR フォールバックの順で現在のステータスを取得する。
 *
 * `options.refresh === true` のときはキャッシュの status を信頼せず、ライブ取得した
 * status を返す。ライブ取得が成功して非 null の status が得られ、かつ既存キャッシュが
 * 存在する場合のみ、その status をキャッシュへ書き戻す（他フィールドは保持）。取得失敗・
 * null のときは書き戻さず、既存キャッシュを破壊しない。
 *
 * @returns ステータス値、PR 経由かどうか、キャッシュヒットかどうかを含む結果
 */
export async function resolveCurrentStatus(
  owner: string,
  repo: string,
  number: number,
  logger: Logger,
  options?: ResolveStatusOptions,
): Promise<ResolvedStatus> {
  const cached = readContextCache<ContextTarget>("issues", String(number));

  // refresh 未指定時は従来どおりキャッシュ優先
  if (!options?.refresh && cached?.status) {
    logger.info(`Issue #${number} のステータスをキャッシュから取得: ${cached.status}`);
    return { status: cached.status, isPr: false, fromCache: true };
  }

  if (options?.refresh) {
    logger.info(`Issue #${number} のステータスをライブから再取得します（--refresh）`);
  }

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
          // refresh 時、既存キャッシュがあれば status を書き戻す（他フィールドは保持）
          if (options?.refresh && cached) {
            writeContextCache("issues", String(number), { ...cached, status: node.status.name });
          }
          return { status: node.status.name, isPr: false, fromCache: false };
        }
      }
      // ライブ status が null（projectItems 空）の場合は書き戻さない（null 上書き防止）
      return { status: null, isPr: false, fromCache: false };
    }
  }

  const prDetail = await getPrDetail(owner, repo, number);
  if (prDetail) {
    // PR は issue キャッシュ前提でないため refresh でも書き戻しは行わない
    return { status: prDetail.status ?? null, isPr: true, fromCache: false };
  }

  return { status: null, isPr: false, fromCache: false };
}
