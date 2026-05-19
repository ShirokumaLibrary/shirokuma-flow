/**
 * pr コマンド - Pull Request 専用サブコマンドファクトリ (#2218 Phase 5-3)
 *
 * items pr 配下のサブコマンド 9 件を `pr` トップレベルカテゴリに昇格する。
 *
 * サブコマンド:
 * - `pr create [number]`: Pull Request を作成（Issue 番号指定でターゲットブランチ・タイトルを自動判定）
 * - `pr list`: Pull Request を一覧表示
 * - `pr show <number>`: PR の詳細を表示
 * - `pr comments <number>`: PR レビュースレッドを取得
 * - `pr merge [number]`: Pull Request をマージ
 * - `pr close [number]`: Pull Request をクローズ
 * - `pr reply <number>`: PR レビューコメントに返信
 * - `pr resolve <number>`: PR レビュースレッドを解決
 * - `pr edit <number>`: PR のメタデータを更新（--base / --title / --body-file）
 */
import { Command } from "commander";
export declare function createPrCommand(): Command;
//# sourceMappingURL=index.d.ts.map