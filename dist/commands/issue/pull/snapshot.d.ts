/**
 * items pull - キャッシュ書き込みなしの API 取得（check コマンド用）(#1808)
 *
 * @related check/compare.ts - compareSnapshots（差分比較ロジック）
 */
import type { RemoteItemSnapshot } from "../../items/types.js";
/**
 * Issue または Discussion の API スナップショットをキャッシュ書き込みなしで取得する。
 *
 * `items check` が差分比較のためだけに使う関数。
 * `fetchAndCacheIssue` / `fetchAndCacheDiscussion` の GraphQL 呼び出しを再利用しつつ、
 * 一時ディレクトリへの書き込みを排除する。
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param number - アイテム番号
 * @param type - 種別（省略時は Issue → Discussion の順で自動判別）
 * @returns スナップショット、または取得失敗時は `null`。
 *   Discussion の場合、Projects フィールド（status/priority/size/labels）は含まれず `undefined` になる。
 */
export declare function fetchRemoteSnapshot(owner: string, repo: string, number: number, type?: "issue" | "discussion"): Promise<RemoteItemSnapshot | null>;
//# sourceMappingURL=snapshot.d.ts.map