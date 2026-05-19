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
 * - `pr edit <number> [body-file]`: PR のメタデータを更新（--base / --title / positional [body-file]）
 */

// Commander.js action callbacks receive localOpts as any; parent opts cast via as at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import {
  createActionLogger,
  setExitCode,
  resolveBodyFileOption,
  resolveFromFileOption,
  mergeCommanderOpts as mergeOpts,
} from "../../utils/cli-helpers.js";

// =============================================================================
// Factory Function
// =============================================================================

export function createPrCommand(): Command {
  const pr = new Command("pr")
    .description(
      "Pull Request 管理 (create, list, show, comments, merge, close, reply, resolve, edit)"
    );

  // 共通親オプション
  pr
    .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
    .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
    .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
    .option("-v, --verbose", "詳細ログ出力");

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  pr
    .command("create [number] [body-file]")
    .description("Pull Request を作成（Issue 番号指定でターゲットブランチ・タイトルを自動判定）")
    .option("--base <branch>", "ターゲットブランチ（Issue 番号指定時は自動判定）")
    .option("-t, --title <title>", "PR タイトル（Issue 番号指定時は自動生成）")
    .option("--head <branch>", "ソースブランチ")
    .option("-f, --from-file <file>", "フロントマター付き Markdown ファイルからメタデータと本文を一括入力")
    .option("--draft", "ドラフト PR として作成")
    .option("--dry-run", "変更を実行せずパラメータをプレビュー")
    .action(async (number, bodyFile, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      if (bodyFile !== undefined) {
        options.bodyFile = bodyFile;
      }
      if (!(await resolveFromFileOption(options, "pr-create"))) return;
      if (!resolveBodyFileOption(options)) return;
      if (number) {
        const { cmdPrCreateFromIssue } = await import("./create-from-issue.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdPrCreateFromIssue(number, options, logger));
      } else {
        const { cmdPrCreate } = await import("./create.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdPrCreate(options, logger));
      }
    });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  pr
    .command("list")
    .description("Pull Request を一覧表示")
    .option("--state <state>", "PR 状態: open, closed, merged, all", "open")
    .option("--limit <number>", "最大取得件数 (デフォルト: 20)", parseInt)
    .option("--format <format>", "出力形式: json, table-json", "table-json")
    .option("--head <branch>", "ヘッドブランチでフィルター（ブランチから PR を逆引き）")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdPrList } = await import("./list.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdPrList(options, logger));
    });

  // ---------------------------------------------------------------------------
  // show
  // ---------------------------------------------------------------------------
  pr
    .command("show <number>")
    .description("PR の詳細を表示")
    .option("--format <format>", "出力形式: json, frontmatter", "frontmatter")
    .option("--to-file <file>", "frontmatter 形式でファイルに出力（- で stdout）")
    .action(async (number, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdPrShow } = await import("./show.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdPrShow(number, options, logger));
    });

  // ---------------------------------------------------------------------------
  // comments
  // ---------------------------------------------------------------------------
  pr
    .command("comments <number>")
    .description("PR レビュースレッドを取得")
    .option("--format <format>", "出力形式: json, table-json", "json")
    .action(async (number, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdPrComments } = await import("./comments.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdPrComments(number, options, logger));
    });

  // ---------------------------------------------------------------------------
  // merge
  // ---------------------------------------------------------------------------
  pr
    .command("merge [number]")
    .description("Pull Request をマージ")
    .option("--squash", "スカッシュマージ (デフォルト)")
    .option("--merge", "マージコミット")
    .option("--rebase", "リベースマージ")
    .option("--delete-branch", "マージ後にブランチを削除 (デフォルト: true)", true)
    .option("--no-delete-branch", "マージ後にブランチを削除しない")
    .option("--checkout", "マージ後にベースブランチをチェックアウト (デフォルト: true)", true)
    .option("--no-checkout", "マージ後にベースブランチをチェックアウトしない")
    .option("--delete-local", "マージ済みローカルブランチを削除 (デフォルト: true)", true)
    .option("--no-delete-local", "マージ済みローカルブランチを削除しない")
    .option("--head <branch>", "ソースブランチ")
    .option("--skip-link-check", "N:N リンクグラフ検証をスキップ")
    .action(async (number, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdMerge } = await import("./merge.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdMerge(number, options, logger));
    });

  // ---------------------------------------------------------------------------
  // close
  // ---------------------------------------------------------------------------
  pr
    .command("close [number]")
    .description("Pull Request をクローズ（マージせずにクローズ）")
    .option("--head <branch>", "ソースブランチ")
    .option("-b, --body-file <file>", "クローズコメント本文ファイルパス、または - で stdin")
    .option("--delete-branch", "クローズ後にリモートブランチを削除 (デフォルト: false)")
    .option("--rollback", "リンク Issue を Completed/Review から In Progress に差し戻す（デフォルト: 警告のみ）")
    .action(async (number, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      if (!resolveBodyFileOption(options)) return;
      const { cmdPrClose } = await import("./close.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdPrClose(number, options, logger));
    });

  // ---------------------------------------------------------------------------
  // reply
  // ---------------------------------------------------------------------------
  pr
    .command("reply <number> <body-file>")
    .description("PR レビューコメントに返信")
    .option("--reply-to <commentId>", "返信先レビューコメントの database ID")
    .action(async (number, bodyFile, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      options.bodyFile = bodyFile;
      if (!resolveBodyFileOption(options)) return;
      const { cmdPrReply } = await import("./reply.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdPrReply(number, options, logger));
    });

  // ---------------------------------------------------------------------------
  // resolve
  // ---------------------------------------------------------------------------
  pr
    .command("resolve <number>")
    .description("PR レビュースレッドを解決")
    .option("--thread-id <threadId>", "解決するスレッド ID (GraphQL node ID)")
    .action(async (number, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdResolve } = await import("./resolve.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdResolve(number, options, logger));
    });

  // ---------------------------------------------------------------------------
  // edit
  // ---------------------------------------------------------------------------
  pr
    .command("edit <number> [body-file]")
    .description("PR のメタデータを更新（ベースブランチ、タイトル、本文）")
    .option("--base <branch>", "新しいベースブランチ")
    .option("-t, --title <title>", "新しいタイトル")
    .option("--dry-run", "変更を実行せずパラメータをプレビュー")
    .action(async (number, bodyFile, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      if (bodyFile !== undefined) {
        options.bodyFile = bodyFile;
      }
      if (!resolveBodyFileOption(options)) return;
      const { cmdPrEdit } = await import("./edit.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdPrEdit(number, options, logger));
    });

  return pr;
}
