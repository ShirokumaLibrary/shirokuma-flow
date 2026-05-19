/**
 * items close/cancel - Issue クローズロジック (#1810, #2024)
 *
 * issues close/cancel ロジックを items サブコマンドとして提供する。
 * #2024 Phase 2-A: validateStatusTransition による遷移検証を追加。
 * cancel 時の子 Issue 自動 unparent を追加。
 */
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../../items/types.js";
/** items close/cancel サブコマンドのオプション */
export interface CloseOptions extends ItemsOptions {
    /** クローズコメント本文（resolveBodyFileOption 後に設定） */
    bodyFile?: string;
    /** Projects Status フィールドを上書き */
    fieldStatus?: string;
    /** クローズ理由: COMPLETED, NOT_PLANNED */
    stateReason?: string;
    /** 子 Issue 未完了ガードをバイパスする */
    force?: boolean;
}
/**
 * items close/cancel - Issue をクローズする。
 * stateReason が NOT_PLANNED の場合は cancel 動作。
 */
export declare function cmdItemClose(issueNumberStr: string, options: CloseOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map