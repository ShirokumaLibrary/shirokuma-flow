/**
 * items link サブコマンド (#2024 Phase 1-C)
 *
 * Issue と Discussion のリンクを管理する。
 * Issue 本文にリンクセクションを自動追記・更新し、`items context` で検出可能にする。
 *
 * 操作:
 * - (デフォルト): Issue に Discussion をリンク追加
 * - --list: リンク一覧表示
 * - --unlink #{number}: リンクを解除
 */
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../../items/types.js";
/** items link サブコマンドのオプション */
export interface LinkOptions extends ItemsOptions {
    /** リンク先の Discussion 番号 */
    discussion?: string;
    /** リンクの種別（省略時は Discussion カテゴリから推定） */
    type?: string;
    /** リンク一覧を表示 */
    list?: boolean;
    /** リンクを解除する Discussion 番号 */
    unlink?: string;
}
export interface LinkEntry {
    discussion: number;
    type: string;
    title?: string;
    category?: string;
    url?: string;
}
/**
 * items link サブコマンド
 *
 * Issue と Discussion のリンクを管理する。
 */
export declare function cmdItemLink(numberStr: string, options: LinkOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map