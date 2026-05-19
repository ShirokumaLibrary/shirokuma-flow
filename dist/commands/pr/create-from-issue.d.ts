/**
 * PR create from issue number - Issue 番号を起点に PR を作成する (#2024 Phase 2-B)
 *
 * Issue 番号からターゲットブランチ・タイトル・本文を自動判定して PR を作成する。
 * `items pr create #{number}` で呼び出される。
 *
 * - ターゲットブランチ: 親 Issue がある場合は Integration ブランチ、なければ develop
 * - PR タイトル: Issue Type からプレフィックスを推定
 * - PR 本文: Closes #{number} を含むテンプレートを生成
 * - バリデーション: In Progress または Completed であること
 */
import { Logger } from "../../utils/logger.js";
import type { IssuesPrOptions } from "./types.js";
/**
 * Issue 番号を起点に PR を作成する。
 */
export declare function cmdPrCreateFromIssue(numberStr: string, options: IssuesPrOptions & {
    draft?: boolean;
}, logger: Logger): Promise<number>;
//# sourceMappingURL=create-from-issue.d.ts.map