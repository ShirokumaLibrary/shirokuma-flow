/**
 * items transition サブコマンド (#2024 Phase 1)
 *
 * Issue のステータス遷移を検証付きで実行する。
 * 不正な遷移を防ぎ、ワークフローの整合性を CLI レベルで保証する。
 *
 * - status-workflow.ts の validateStatusTransition と STATUS_TRANSITIONS を使用
 * - Draft → Backlog 遷移時は Issue をプロジェクトに追加
 * - --to Blocked 時は --reason が必須（reason は Issue コメントとして記録）
 * - キャッシュを優先参照し、なければ API フォールバック
 */
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../types.js";
/** items transition サブコマンドのオプション */
export interface TransitionOptions extends ItemsOptions {
    /** 遷移先ステータス（必須） */
    to: string;
    /** 遷移ルールを無視して強制遷移 */
    force?: boolean;
    /** Blocked 遷移時の reason（必須）。Issue コメントとして記録される。 */
    reason?: string;
}
export interface TransitionResult {
    number: number;
    from: string | null;
    to: string;
    result: "ok" | "error";
    message?: string;
    allowed_transitions?: string[];
}
/**
 * items transition サブコマンド
 *
 * Issue のステータス遷移を検証付きで実行する。
 */
export declare function cmdItemTransition(numberStr: string, options: TransitionOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map