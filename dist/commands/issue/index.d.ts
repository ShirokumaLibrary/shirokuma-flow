/**
 * issue コマンド - Issue 専用サブコマンドファクトリ (#2217 Phase 5-2)
 *
 * items コマンドから Issue 専用サブコマンドを分離し、新カテゴリ `issue` として提供する。
 *
 * サブコマンド（キャッシュ管理）:
 * - `issue pull <number>`: GitHub → キャッシュ（本体 + コメント）
 * - `issue push <number> [commentId]`: キャッシュ → GitHub（本体または特定コメント）
 * - `issue add --file <file>`: Issue を作成してキャッシュに移動
 * - `issue comment <number> --file <file>`: コメントを追加してキャッシュに移動
 * - `issue check [number]`: ローカルとリモートの差分を表示
 * - `issue close <number>`: Issue をクローズ
 * - `issue cancel <number>`: Issue をキャンセル (NOT_PLANNED でクローズ)
 * - `issue reopen <number>`: クローズ済み Issue を再オープン
 * - `issue remove <number>`: プロジェクトから Issue を削除
 * - `issue fields`: プロジェクトフィールド定義を表示
 *
 * サブコマンド（GitHub 参照・管理）:
 * - `issue list`: Issue 一覧を Projects フィールド付きで取得
 * - `issue comments <number>`: Issue の全コメントを一覧表示
 * - `issue assign <number> <user>`: Issue に担当者を追加
 * - `issue unassign <number> <user>`: Issue から担当者を削除
 * - `issue parent <number> <parent-number>`: Issue を親 Issue のサブ Issue に設定
 * - `issue unparent <number>`: Issue の親 Issue 紐付けを解除
 * - `issue sub-list <parent>`: 親 Issue のサブ Issue を一覧表示
 * - `issue import`: 公開リポジトリから Issue をインポート
 * - `issue update <number>`: Issue の本文・メタデータを1コマンドで更新
 * - `issue context <number>`: 関連情報を一括取得してキャッシュに書き込む
 * - `issue branch <number>`: Issue 番号を起点にフィーチャーブランチを作成
 * - `issue link <number>`: Issue と Discussion のリンクを管理
 * - `issue rollback <number>`: Issue / PR の切り戻し操作
 * - `issue search <query>`: Issue / PR / Discussion を横断検索
 * - `issue template`: Issue / PR / ADR / コメントのテンプレートを生成
 */
import { Command } from "commander";
export declare function createIssueCommand(): Command;
//# sourceMappingURL=index.d.ts.map