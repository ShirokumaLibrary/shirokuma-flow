/**
 * items check サブコマンド (#1808)
 *
 * ローカルキャッシュとリモートの状態を比較し、差分サマリーを表示する。
 * 実際の更新は行わない（push コマンドが担当）。
 *
 * 比較対象フィールド:
 * - body: 本文
 * - title: タイトル
 * - status: Projects Status フィールド（Issue のみ）
 * - priority: Projects Priority フィールド（Issue のみ）
 * - size: Projects Size フィールド（Issue のみ）
 * - labels: ラベル（Issue のみ）
 */
import type { Logger } from "../../../utils/logger.js";
import type { CheckOptions, CheckResult } from "../../items/types.js";
/**
 * items check サブコマンド
 *
 * 番号が指定された場合は単一アイテムをチェック。
 * 番号が省略された場合はキャッシュディレクトリ内の全アイテムをチェック。
 */
export declare function cmdCheck(numberStr: string | undefined, options: CheckOptions, logger: Logger): Promise<number>;
/**
 * 単一アイテムのチェック
 */
export declare function checkSingleItem(owner: string, repo: string, number: number, baseDir: string, logger: Logger): Promise<CheckResult>;
/**
 * キャッシュディレクトリ内の全アイテムをチェック
 */
export declare function checkAllItems(owner: string, repo: string, baseDir: string, logger: Logger): Promise<number>;
//# sourceMappingURL=index.d.ts.map