/**
 * status transition サブコマンド
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
import type { ItemsOptions } from "../../items/types.js";
/** items transition サブコマンドのオプション */
export interface TransitionOptions extends ItemsOptions {
    /** 遷移先ステータス（必須） */
    to: string;
    /**
     * 中間ステータス（オプション）。指定された場合、from → via → to の 2 段階で
     * 遷移を実行する。validateStatusTransition は via への遷移と via からの遷移を
     * 個別に検証する。途中で失敗した場合は via で停止し、エラーを返す。
     *
     * 用途: `Backlog → In progress → Review` のように直接遷移が許可されていない
     * 経路を 1 コマンドで実行する（plan-issue の計画 Issue 完了遷移など）。
     */
    via?: string;
    /** 遷移ルールを無視して強制遷移 */
    force?: boolean;
    /** Blocked 遷移時の reason（必須）。Issue コメントとして記録される。 */
    reason?: string;
}
export interface TransitionResult {
    number: number;
    from: string | null;
    to: string;
    /** 経由した中間ステータス（--via 指定時） */
    via?: string;
    result: "ok" | "error";
    message?: string;
    allowed_transitions?: string[];
    /** --via 使用時、中間遷移失敗箇所（"to_via" or "from_via"） */
    failed_at?: "to_via" | "from_via";
}
/**
 * items transition サブコマンド
 *
 * Issue のステータス遷移を検証付きで実行する。
 */
export declare function cmdItemTransition(numberStr: string, options: TransitionOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map