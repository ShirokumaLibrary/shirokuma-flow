/**
 * items assign/unassign - Issue 担当者管理ロジック (#1810)
 */
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../types.js";
/**
 * items assign - Issue に担当者を追加する。
 * @me を指定した場合は認証ユーザーに解決する。
 */
export declare function cmdItemAssign(issueNumberStr: string, userInput: string, options: ItemsOptions, logger: Logger): Promise<number>;
/**
 * items unassign - Issue から担当者を削除する。
 * @me を指定した場合は認証ユーザーに解決する。
 */
export declare function cmdItemUnassign(issueNumberStr: string, userInput: string, options: ItemsOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map