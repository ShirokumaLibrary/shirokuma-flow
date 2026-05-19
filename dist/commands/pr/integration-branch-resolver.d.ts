/**
 * Integration ブランチ解決ヘルパー
 *
 * PR 作成時のベースブランチ判定ロジックを共通化する。
 *
 * ベースブランチ判定マトリクス:
 * - Case 1: integration 検出済み + optionsBase 未指定 → integration を自動採用
 * - Case 2: integration 検出済み + optionsBase 明示   → 警告 + optionsBase を使用
 * - Case 3: integration 未検出  + optionsBase 未指定 + サブ Issue → エラーで停止
 * - その他: optionsBase ?? "develop"
 */
import type { Logger } from "../../utils/logger.js";
export interface ResolveIntegrationBaseBranchInput {
    parentNumber: number | null;
    parentBody: string | null;
    optionsBase: string | undefined;
    logger: Logger;
}
export interface ResolveIntegrationBaseBranchResult {
    baseBranch: string;
    isIntegrationTarget: boolean;
}
/**
 * PR 作成時のベースブランチを解決する。エラー（Case 3）時は null を返すため、
 * 呼び出し元はチェックして early return すること。
 */
export declare function resolveIntegrationBaseBranch(input: ResolveIntegrationBaseBranchInput): Promise<ResolveIntegrationBaseBranchResult | null>;
//# sourceMappingURL=integration-branch-resolver.d.ts.map