/**
 * items check - 差分比較ロジック (#1808)
 *
 * @related pull/snapshot.ts - fetchRemoteSnapshot（API スナップショット取得）
 */

import type { CacheMetadata } from "../../../utils/github-cache.js";
import type { DiffField } from "../../items/types.js";

// =============================================================================
// 差分比較ロジック
// =============================================================================

/**
 * ローカルキャッシュとリモートスナップショットを比較して差分を返す。
 */
export function compareSnapshots(
  localMeta: CacheMetadata,
  localBody: string,
  remoteTitle: string,
  remoteBody: string,
  remoteStatus?: string,
  remotePriority?: string,
  remoteSize?: string,
  remoteLabels?: string[]
): DiffField[] {
  const diffs: DiffField[] = [];

  // 本文の差分
  if (localBody.trim() !== remoteBody.trim()) {
    diffs.push({ field: "body", local: "(ローカルに変更あり)", remote: "(リモートの本文)" });
  }

  // タイトルの差分
  const localTitle = typeof localMeta.title === "string" ? localMeta.title : undefined;
  if (localTitle !== undefined && localTitle !== remoteTitle) {
    diffs.push({ field: "title", local: localTitle, remote: remoteTitle });
  }

  // Projects フィールドの差分
  const localStatus = typeof localMeta.status === "string" ? localMeta.status : undefined;
  if (localStatus !== undefined && localStatus !== remoteStatus) {
    diffs.push({ field: "status", local: localStatus, remote: remoteStatus ?? null });
  }

  const localPriority = typeof localMeta.priority === "string" ? localMeta.priority : undefined;
  if (localPriority !== undefined && localPriority !== remotePriority) {
    diffs.push({ field: "priority", local: localPriority, remote: remotePriority ?? null });
  }

  const localSize = typeof localMeta.size === "string" ? localMeta.size : undefined;
  if (localSize !== undefined && localSize !== remoteSize) {
    diffs.push({ field: "size", local: localSize, remote: remoteSize ?? null });
  }

  // ラベルの差分（配列比較）
  const localLabels = Array.isArray(localMeta.labels) ? (localMeta.labels as string[]).sort() : undefined;
  const sortedRemoteLabels = remoteLabels ? [...remoteLabels].sort() : undefined;
  if (localLabels !== undefined && JSON.stringify(localLabels) !== JSON.stringify(sortedRemoteLabels)) {
    diffs.push({
      field: "labels",
      local: localLabels,
      remote: sortedRemoteLabels ?? null,
    });
  }

  return diffs;
}
