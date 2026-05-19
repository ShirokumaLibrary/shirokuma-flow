/**
 * items branch サブコマンド (#2024 Phase 1-B)
 *
 * Issue 番号を起点にフィーチャーブランチを作成する。
 * ブランチ名・ベースブランチを自動判定し、スキルの命名ミスや判定漏れを防ぐ。
 *
 * - ブランチ名: {prefix}/{number}-{slug}
 * - ベースブランチ: 親 Issue がある場合は integration ブランチ、なければ develop
 * - Integration ブランチが未存在で親が Epic の場合は自動作成
 */
import type { Logger } from "../../../utils/logger.js";
import type { ItemsOptions } from "../../items/types.js";
/** items branch サブコマンドのオプション */
export interface BranchOptions extends ItemsOptions {
    /** ベースブランチ（省略時は自動判定） */
    base?: string;
    /** ブランチプレフィックス（省略時は Issue Type から推定） */
    prefix?: string;
    /** ブランチ名を表示するが作成しない */
    dryRun?: boolean;
}
export interface BranchResult {
    branch: string;
    base: string;
    issue: number;
    created: boolean;
    integration_branch?: {
        branch: string;
        created: boolean;
    };
}
/**
 * 親 Issue の Integration ブランチを検出する。
 * 1. 親 Issue 本文の Integration Branch セクション
 * 2. リモートで "{prefix}/{親番号}-{slug}" パターンで検索
 */
export declare function findIntegrationBranch(parentNumber: number, parentBody: string | undefined): Promise<string | null>;
/**
 * items branch サブコマンド
 *
 * Issue 番号を起点にフィーチャーブランチを作成する。
 */
export declare function cmdItemBranch(numberStr: string, options: BranchOptions, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map