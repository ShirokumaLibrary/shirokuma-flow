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

// Commander.js action callbacks receive localOpts as any; parent opts cast via as at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import { resolveBodyFileOption, createActionLogger, setExitCode, mergeCommanderOpts as mergeOpts } from "../../utils/cli-helpers.js";

// =============================================================================
// Helper
// =============================================================================

/** Resolve --field-priority / --field-size aliases to --priority / --size */
function resolveFieldAliases(options: Record<string, unknown>): void {
  options.priority ??= options.fieldPriority;
  options.size ??= options.fieldSize;
}

// =============================================================================
// Factory Function
// =============================================================================

export function createProjectCommand(): Command {
  const project = new Command("project")
    .description(
      "GitHub Projects V2 管理 (list, get, fields, create, update, delete, add-issue, workflows, setup, setup-metrics)"
    );

  // 共通親オプション
  project
    .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
    .option("--format <format>", "出力形式: json, table-json")
    .option("-v, --verbose", "詳細ログ出力");

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  project
    .command("list")
    .description("プロジェクトアイテムを一覧表示 (Done/Released はデフォルトで除外)")
    .option("--all", "全アイテムを含める (Done/Released)")
    .option("--status <status...>", "ステータスでフィルタ")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdList } = await import("./list.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdList(options, logger));
    });

  // ---------------------------------------------------------------------------
  // get
  // ---------------------------------------------------------------------------
  project
    .command("get <target>")
    .description("ID または Issue 番号でアイテム詳細を取得")
    .action(async (target, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdGet } = await import("./get.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdGet(target, options, logger));
    });

  // ---------------------------------------------------------------------------
  // fields
  // ---------------------------------------------------------------------------
  project
    .command("fields")
    .description("利用可能なフィールドオプションを表示")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdFields } = await import("./fields.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdFields(options, logger));
    });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  project
    .command("create")
    .description("プロジェクトに新しいドラフト Issue を作成")
    .option("-t, --title <title>", "アイテムタイトル")
    .option("-b, --body-file <file>", "本文ファイルパス、または - で stdin")
    .option("-s, --field-status <status>", "Status フィールドを設定")
    .option("--priority <priority>", "Priority フィールドを設定 (Critical/High/Medium/Low)")
    .option("--field-priority <priority>", "(--priority のエイリアス)")
    .option("--size <size>", "Size フィールドを設定 (XS/S/M/L/XL)")
    .option("--field-size <size>", "(--size のエイリアス)")
    .action(async (localOpts, command: Command) => {
      if (!resolveBodyFileOption(localOpts)) return;
      const options = mergeOpts(command, localOpts);
      resolveFieldAliases(options);
      const { cmdCreate } = await import("./create.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdCreate(options, logger));
    });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  project
    .command("update <target>")
    .description("アイテムのフィールドを更新")
    .option("-t, --title <title>", "アイテムタイトル")
    .option("-b, --body-file <file>", "本文ファイルパス、または - で stdin")
    .option("-s, --field-status <status>", "Status フィールドを設定")
    .option("--priority <priority>", "Priority フィールドを設定 (Critical/High/Medium/Low)")
    .option("--field-priority <priority>", "(--priority のエイリアス)")
    .option("--size <size>", "Size フィールドを設定 (XS/S/M/L/XL)")
    .option("--field-size <size>", "(--size のエイリアス)")
    .action(async (target, localOpts, command: Command) => {
      if (!resolveBodyFileOption(localOpts)) return;
      const options = mergeOpts(command, localOpts);
      resolveFieldAliases(options);
      const { cmdUpdate } = await import("./update.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdUpdate(target, options, logger));
    });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------
  project
    .command("delete <target>")
    .description("プロジェクトからアイテムを削除")
    .option("-f, --force", "確認をスキップ")
    .action(async (target, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdDelete } = await import("./delete.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdDelete(target, options, logger));
    });

  // ---------------------------------------------------------------------------
  // add-issue
  // ---------------------------------------------------------------------------
  project
    .command("add-issue <target>")
    .description("既存 Issue をプロジェクトに追加")
    .option("-s, --field-status <status>", "Status フィールドを設定")
    .option("--priority <priority>", "Priority フィールドを設定 (Critical/High/Medium/Low)")
    .option("--field-priority <priority>", "(--priority のエイリアス)")
    .option("--size <size>", "Size フィールドを設定 (XS/S/M/L/XL)")
    .option("--field-size <size>", "(--size のエイリアス)")
    .action(async (target, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      resolveFieldAliases(options);
      const { cmdAddIssue } = await import("./add-issue.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdAddIssue(target, options, logger));
    });

  // ---------------------------------------------------------------------------
  // workflows
  // ---------------------------------------------------------------------------
  project
    .command("workflows")
    .description("ビルトイン自動化ワークフローの状態を表示")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdWorkflows } = await import("./workflows.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdWorkflows(options, logger));
    });

  // ---------------------------------------------------------------------------
  // setup
  // ---------------------------------------------------------------------------
  project
    .command("setup")
    .description("Status/Priority/Size フィールドをセットアップ")
    .option("--lang <lang>", "フィールド説明の言語: en, ja")
    .option("--field-id <fieldId>", "Status フィールド ID")
    .option("--project-id <projectId>", "プロジェクト ID")
    .option("--status-only", "Status フィールドのみ更新")
    .option("--dry-run", "変更を実行せずプレビュー")
    .option("-f, --force", "破壊的更新を強制実行")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdSetup } = await import("./setup.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdSetup(options, logger));
    });

  // ---------------------------------------------------------------------------
  // setup-metrics
  // ---------------------------------------------------------------------------
  project
    .command("setup-metrics")
    .description("メトリクス追跡用テキストフィールドを作成")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdSetupMetrics } = await import("./setup-metrics.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdSetupMetrics(options, logger));
    });

  return project;
}
