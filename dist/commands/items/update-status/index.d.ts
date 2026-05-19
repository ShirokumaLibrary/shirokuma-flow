/**
 * items update-status - Issue ステータスを一括更新 (#1823)
 *
 * Issue ステータス更新と Issue コメント投稿に特化する。
 */
import { Logger } from "../../../utils/logger.js";
export interface UpdateStatusOptions {
    owner?: string;
    verbose?: boolean;
    done?: string[];
    review?: string[];
    issueComment?: string[];
    issueCommentFile?: string;
    /** 子 Issue 未完了ガードをバイパスする */
    force?: boolean;
}
/**
 * Issue ステータスを一括更新する。
 * --done: 指定 Issue を Done に更新してクローズ
 * --review: 指定 Issue を Review に更新（マージ済み PR がある場合は Done）
 * --issue-comment + --issue-comment-file: Issue コメントを投稿
 */
export declare function cmdUpdateStatus(options: UpdateStatusOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map