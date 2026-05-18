/**
 * items push - Discussion 本体の push ロジック (#1808)
 *
 * @related pull/discussion.ts - Discussion 取得・キャッシュ書き込み
 * @related add/discussion.ts - Discussion 作成ロジック
 */

import { runGraphQL, validateBody } from "../../../utils/github.js";
import { writeCache } from "../../../utils/github-cache.js";
import {
  GRAPHQL_MUTATION_UPDATE_DISCUSSION,
} from "../../discussions/helpers.js";
import type { Logger } from "../../../utils/logger.js";
import type { CacheMetadata } from "../../../utils/github-cache.js";
import type { PushOptions } from "../../items/types.js";

// =============================================================================
// GraphQL クエリ定義
// =============================================================================

/** Discussion GraphQL ID + title を番号から取得 */
export const GRAPHQL_QUERY_DISCUSSION_TITLE = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
      id
      title
      body
      updatedAt
    }
  }
}
`;

// =============================================================================
// 型定義
// =============================================================================

export interface DiscussionTitleQueryResult {
  data?: {
    repository?: {
      discussion?: {
        id?: string;
        title?: string;
        body?: string;
        updatedAt?: string;
      };
    };
  };
}

// =============================================================================
// Discussion 本体 push
// =============================================================================

/** Discussion 本体を push */
export async function pushDiscussionBody(
  owner: string,
  repo: string,
  number: number,
  localBody: string,
  localMeta: CacheMetadata,
  _options: PushOptions,
  logger: Logger
): Promise<number> {
  // 本文の不正 Unicode 検証
  const bodyError = validateBody(localBody);
  if (bodyError) {
    logger.error(bodyError);
    return 1;
  }

  // リモートから現在の Discussion 情報を取得
  const remoteResult = await runGraphQL<DiscussionTitleQueryResult>(GRAPHQL_QUERY_DISCUSSION_TITLE, {
    owner,
    name: repo,
    number,
  });

  if (!remoteResult.success || !remoteResult.data?.data?.repository?.discussion) {
    logger.error(`Discussion #${number} が見つかりません`);
    return 1;
  }

  const remoteDiscussion = remoteResult.data.data.repository.discussion;
  const discussionGqlId = remoteDiscussion.id;

  if (!discussionGqlId) {
    logger.error(`Discussion #${number} の GraphQL ID が取得できません`);
    return 1;
  }

  // 差分を検出
  const changes: Record<string, { local: unknown; remote: unknown }> = {};
  let hasChanges = false;

  // 本文の差分
  const remoteBody = remoteDiscussion.body ?? "";
  if (localBody.trim() !== remoteBody.trim()) {
    changes.body = { local: localBody, remote: remoteBody };
    hasChanges = true;
  }

  // タイトルの差分
  const remoteTitle = remoteDiscussion.title ?? "";
  const localTitle = typeof localMeta.title === "string" ? localMeta.title : "";
  if (localTitle && localTitle !== remoteTitle) {
    changes.title = { local: localTitle, remote: remoteTitle };
    hasChanges = true;
  }

  if (!hasChanges) {
    logger.info(`Discussion #${number}: 差分なし`);
    console.log(JSON.stringify({ number, type: "discussion", changed: false }, null, 2));
    return 0;
  }

  // Discussion 更新
  const updateResult = await runGraphQL(GRAPHQL_MUTATION_UPDATE_DISCUSSION, {
    discussionId: discussionGqlId,
    title: changes.title ? localTitle : remoteTitle,
    body: changes.body ? localBody : remoteBody,
  });

  if (!updateResult.success) {
    logger.error(`Discussion #${number} の更新に失敗しました`);
    return 1;
  }

  logger.success(`Discussion #${number}: 更新しました`);

  // キャッシュの cached_at を更新
  writeCache(number, {
    ...localMeta,
    number,
    type: "discussion",
  }, localBody, owner, repo);

  console.log(JSON.stringify({
    number,
    type: "discussion",
    changed: true,
    changes: Object.keys(changes),
  }, null, 2));
  return 0;
}
