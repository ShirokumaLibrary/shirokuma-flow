/**
 * items context サブコマンド (#2024 Phase 1)
 *
 * 指定された Issue / PR を起点に関連情報を一括取得し、
 * `.shirokuma/cache/` にキャッシュとして書き込む。
 *
 * 取得内容:
 * - 対象 Issue / PR の本文・ステータス・ラベル・担当者
 * - 親 Issue（あれば）
 * - 子 Issue（あれば）
 * - 本文からリンクされた Discussion
 * - 関連 PR（Closes #{N} の逆引き）
 * - 各アイテムの最新コメント
 */
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../types.js";
/** items context サブコマンドのオプション */
export interface ContextOptions extends ItemsOptions {
    /** キャッシュを使わず強制的に API から取得 */
    noCache?: boolean;
}
export interface ContextTarget {
    number: number;
    type: "issue" | "pull_request";
    title: string;
    body: string;
    status?: string;
    labels: string[];
    assignees: string[];
}
export interface ContextParent {
    number: number;
    title: string;
    status?: string;
}
export interface ContextChild {
    number: number;
    title: string;
    status?: string;
}
export interface ContextDiscussion {
    number: number;
    category: string;
    title: string;
    url: string;
}
export interface ContextPR {
    number: number;
    title: string;
    state: string;
    base: string;
    head: string;
}
export interface ContextComment {
    source: string;
    author: string;
    body: string;
    created_at: string;
}
export interface ContextData {
    target: ContextTarget;
    parent: ContextParent | null;
    children: ContextChild[];
    discussions: ContextDiscussion[];
    pull_requests: ContextPR[];
    recent_comments: ContextComment[];
}
/**
 * items context サブコマンド
 *
 * Issue / PR を起点に関連情報を一括取得し、コンテキストキャッシュに書き込む。
 */
export declare function cmdItemContext(numberStr: string, options: ContextOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map