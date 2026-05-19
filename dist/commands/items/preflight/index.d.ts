/**
 * items preflight - セッション終了前のデータを一括取得 (#1823)
 *
 * git 状態、アクティブ Issue、マージ済み PR 検出、
 * セッションバックアップ、警告を一括取得する。
 */
import { Logger } from "../../../utils/logger.js";
import { type PreflightIssue, type PreflightPr, type PreflightOutput, type PreflightGitState } from "../shared/session-utils.js";
export type { PreflightIssue, PreflightPr, PreflightOutput, PreflightGitState };
export interface PreflightOptions {
    owner?: string;
    verbose?: boolean;
}
/**
 * git 状態とバックアップ数からプリフライト警告を生成する。
 * Pure function - API 呼び出しなし。
 */
export declare function generatePreflightWarnings(git: PreflightGitState, sessionBackups: number): string[];
/**
 * セッション終了前のデータを一括取得する。
 * プログラム的消費向けのフラット JSON を返す。
 */
export declare function cmdPreflight(options: PreflightOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map