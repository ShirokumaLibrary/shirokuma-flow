/**
 * project コマンド - GitHub Projects V2 専用サブコマンドファクトリ (#2220 Phase 5-5)
 *
 * `items projects` と トップレベル `projects` の 2 経路に分散していた Project V2 操作を
 * 新トップレベル `project` に一本化する。
 * 旧 `items projects` / `projects` は deprecation alias として維持。
 *
 * サブコマンド（10 コマンド）:
 * - `project list`:             プロジェクトアイテムを一覧表示
 * - `project get <target>`:     アイテム詳細を取得
 * - `project fields`:           利用可能なフィールドオプションを表示
 * - `project create`:           プロジェクトに新しいドラフト Issue を作成
 * - `project update <target>`:  アイテムのフィールドを更新
 * - `project delete <target>`:  プロジェクトからアイテムを削除
 * - `project add-issue <target>`: 既存 Issue をプロジェクトに追加
 * - `project workflows`:        ビルトイン自動化ワークフローの状態を表示
 * - `project setup`:            Status/Priority/Size フィールドをセットアップ
 * - `project setup-metrics`:    メトリクス追跡用テキストフィールドを作成
 */
import { Command } from "commander";
export declare function createProjectCommand(): Command;
//# sourceMappingURL=index.d.ts.map