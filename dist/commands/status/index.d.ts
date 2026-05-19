/**
 * status コマンド - Issue ステータス管理サブコマンドファクトリ
 *
 * サブコマンド:
 * - `status transition <number> --to <status>`: ステータス遷移を検証付きで実行
 * - `status approve <number>`: Review → Done 承認遷移
 * - `status update-batch`: Issue ステータスを一括更新
 * - `status get <number>`: 現在ステータスと遷移先候補を取得
 * - `status allowed <N> | --status <S>`: 遷移可能なステータス一覧を返す
 * - `status history <number>`: Status 変更履歴をタイムスタンプ付きで取得（Projects V2 対応）
 */
import { Command } from "commander";
export declare function createStatusCommand(): Command;
//# sourceMappingURL=index.d.ts.map