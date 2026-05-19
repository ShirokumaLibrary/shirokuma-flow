/**
 * items check - 差分比較ロジック (#1808)
 *
 * @related pull/snapshot.ts - fetchRemoteSnapshot（API スナップショット取得）
 */
import type { CacheMetadata } from "../../../utils/github-cache.js";
import type { DiffField } from "../../items/types.js";
/**
 * ローカルキャッシュとリモートスナップショットを比較して差分を返す。
 */
export declare function compareSnapshots(localMeta: CacheMetadata, localBody: string, remoteTitle: string, remoteBody: string, remoteStatus?: string, remotePriority?: string, remoteSize?: string, remoteLabels?: string[]): DiffField[];
//# sourceMappingURL=compare.d.ts.map