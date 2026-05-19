/**
 * Issue / PR のステータス解決ヘルパー
 *
 * `status get` / `status allowed` / `status transition` で共通利用する。
 * キャッシュ優先 → GraphQL → PR フォールバックの順で現在ステータスを取得する。
 */
import type { Logger } from "../../../utils/logger.js";
export interface ResolvedStatus {
    status: string | null;
    isPr: boolean;
    fromCache: boolean;
}
/**
 * キャッシュ → GraphQL → PR フォールバックの順で現在のステータスを取得する。
 *
 * @returns ステータス値、PR 経由かどうか、キャッシュヒットかどうかを含む結果
 */
export declare function resolveCurrentStatus(owner: string, repo: string, number: number, logger: Logger): Promise<ResolvedStatus>;
//# sourceMappingURL=resolve-status.d.ts.map