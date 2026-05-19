/**
 * items rollback サブコマンド (#2024 Phase 1-D)
 *
 * 指定された Issue / PR に対して切り戻し操作をアトミックに実行する。
 *
 * アクション:
 * - cancel: 課題・計画のキャンセル（子 Issue unparent + PR クローズ + ブランチ削除 + ステータス変更）
 * - reset: 計画を作業前（Ready）に戻す（area:plan ラベルチェック）
 * - revert: revert ブランチ作成 + revert PR 作成
 */
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../../items/types.js";
/** items rollback サブコマンドのオプション */
export interface RollbackOptions extends ItemsOptions {
    /** アクション: cancel | reset | revert */
    action: string;
    /** 実行内容を表示するが実行しない */
    dryRun?: boolean;
    /** 確認プロンプトをスキップ */
    force?: boolean;
}
export interface RollbackOperation {
    type: string;
    number?: number;
    branch?: string;
    from?: string;
    to?: string;
    result: "ok" | "error" | "skipped";
    message?: string;
}
export interface RollbackResult {
    action: string;
    target: {
        number: number;
        status: string;
    };
    operations: RollbackOperation[];
    errors: string[];
}
/**
 * items rollback サブコマンド
 *
 * Issue に対して切り戻し操作を実行する。
 */
export declare function cmdItemRollback(numberStr: string, options: RollbackOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map