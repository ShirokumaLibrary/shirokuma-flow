/**
 * discussion コマンド - Discussion + ADR 専用サブコマンドファクトリ (#2219 Phase 5-4, #2222 Phase 5-7)
 *
 * Discussion / ADR をトップレベルカテゴリで統合管理する。
 * ADR は `discussion adr` ネストとして配置。
 *
 * サブコマンド:
 * - `discussion add --file <file>`: Discussion を作成してキャッシュに移動
 * - `discussion categories`: 利用可能な Discussion カテゴリを一覧表示
 * - `discussion list`: Discussion を一覧表示
 * - `discussion show <number>`: Discussion の詳細を取得
 * - `discussion search <query>`: Discussion をキーワード検索
 * - `discussion templates`: Discussion テンプレートを生成
 * - `discussion adr create <title>`: ADR Discussion を作成
 * - `discussion adr list`: ADR Discussion を一覧表示
 * - `discussion adr get <number>`: ADR Discussion の詳細を取得
 */
import { Command } from "commander";
export declare function createDiscussionCommand(): Command;
//# sourceMappingURL=index.d.ts.map