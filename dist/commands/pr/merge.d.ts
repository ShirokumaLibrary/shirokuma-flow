/**
 * PR merge subcommand - Merge a pull request
 *
 * Merges a PR with configurable method (squash/merge/rebase),
 * handles branch deletion, linked issue status updates, and
 * local git operations.
 *
 * #2024 Phase 2-C: 後続処理の自動判定と次のアクション提示を追加。
 * - 計画 Issue → Done
 * - 単一計画の場合は課題 Issue → Done
 * - 全計画完了時は integration → develop の PR を自動作成
 * - 次の Ready 計画の提示
 */
import { Logger } from "../../utils/logger.js";
import type { IssuesPrOptions } from "./types.js";
export declare function cmdMerge(prNumberStr: string | undefined, options: IssuesPrOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=merge.d.ts.map