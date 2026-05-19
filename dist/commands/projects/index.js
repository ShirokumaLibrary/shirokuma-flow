/**
 * projects command - Commander.js nested subcommand factory
 *
 * Creates the top-level `projects` Command with all subcommands registered.
 * Each subcommand imports its handler dynamically in the action handler.
 *
 * Phase 5-5 以降、`project` トップレベルカテゴリへの deprecation alias として機能する (#2220)。
 * 新規コードは `project` コマンドを使用すること。
 *
 * Usage in index.ts:
 *   import { createProjectsCommand } from "./commands/projects/index.js";
 *   program.addCommand(createProjectsCommand());
 */
// Commander.js action callbacks receive localOpts as any; parent opts cast via as at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import { resolveBodyFileOption, createActionLogger, setExitCode } from "../../utils/cli-helpers.js";
// =============================================================================
// Factory Function
// =============================================================================
/** Resolve --field-priority / --field-size aliases to --priority / --size */
function resolveFieldAliases(options) {
    options.priority ??= options.fieldPriority;
    options.size ??= options.fieldSize;
}
export function createProjectsCommand() {
    const projects = new Command("projects")
        .description("[非推奨] `project` コマンドを使用してください。GitHub Projects V2 管理 (list, get, fields, create, update, delete, add-issue, workflows, setup-metrics, setup, create-project)");
    // Common parent options (available to all subcommands via command.parent?.opts())
    projects
        .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
        .option("--format <format>", "出力形式: json, table-json")
        .option("-v, --verbose", "詳細ログ出力");
    // deprecation 警告: `projects` → `project` トップレベルに移行済み (#2220)
    projects.hook("preSubcommand", (_thisCommand, _subcommand) => {
        process.stderr.write("⚠ 'projects' は非推奨です。代わりに 'project' を使用してください。\n");
    });
    // ---------------------------------------------------------------------------
    // list
    // ---------------------------------------------------------------------------
    projects
        .command("list")
        .description("プロジェクトアイテムを一覧表示 (Done/Released はデフォルトで除外)")
        .option("--all", "全アイテムを含める (Done/Released)")
        .option("--status <status...>", "ステータスでフィルタ")
        .action(async (localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdList } = await import("./list.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdList(options, logger));
    });
    // ---------------------------------------------------------------------------
    // get
    // ---------------------------------------------------------------------------
    projects
        .command("get <target>")
        .description("ID または Issue 番号でアイテム詳細を取得")
        .action(async (target, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdGet } = await import("./get.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdGet(target, options, logger));
    });
    // ---------------------------------------------------------------------------
    // fields
    // ---------------------------------------------------------------------------
    projects
        .command("fields")
        .description("利用可能なフィールドオプションを表示")
        .action(async (localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdFields } = await import("./fields.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdFields(options, logger));
    });
    // ---------------------------------------------------------------------------
    // create
    // ---------------------------------------------------------------------------
    projects
        .command("create")
        .description("プロジェクトに新しいドラフト Issue を作成")
        .option("-t, --title <title>", "アイテムタイトル")
        .option("-b, --body-file <file>", "本文ファイルパス、または - で stdin")
        .option("-s, --field-status <status>", "Status フィールドを設定")
        .option("--priority <priority>", "Priority フィールドを設定 (Critical/High/Medium/Low)")
        .option("--field-priority <priority>", "(--priority のエイリアス)")
        .option("--size <size>", "Size フィールドを設定 (XS/S/M/L/XL)")
        .option("--field-size <size>", "(--size のエイリアス)")
        .action(async (localOpts, command) => {
        if (!resolveBodyFileOption(localOpts))
            return;
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        resolveFieldAliases(options);
        const { cmdCreate } = await import("./create.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdCreate(options, logger));
    });
    // ---------------------------------------------------------------------------
    // update
    // ---------------------------------------------------------------------------
    projects
        .command("update <target>")
        .description("アイテムのフィールドを更新")
        .option("-t, --title <title>", "アイテムタイトル")
        .option("-b, --body-file <file>", "本文ファイルパス、または - で stdin")
        .option("-s, --field-status <status>", "Status フィールドを設定")
        .option("--priority <priority>", "Priority フィールドを設定 (Critical/High/Medium/Low)")
        .option("--field-priority <priority>", "(--priority のエイリアス)")
        .option("--size <size>", "Size フィールドを設定 (XS/S/M/L/XL)")
        .option("--field-size <size>", "(--size のエイリアス)")
        .action(async (target, localOpts, command) => {
        if (!resolveBodyFileOption(localOpts))
            return;
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        resolveFieldAliases(options);
        const { cmdUpdate } = await import("./update.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdUpdate(target, options, logger));
    });
    // ---------------------------------------------------------------------------
    // delete
    // ---------------------------------------------------------------------------
    projects
        .command("delete <target>")
        .description("プロジェクトからアイテムを削除")
        .option("-f, --force", "確認をスキップ")
        .action(async (target, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdDelete } = await import("./delete.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdDelete(target, options, logger));
    });
    // ---------------------------------------------------------------------------
    // add-issue
    // ---------------------------------------------------------------------------
    projects
        .command("add-issue <target>")
        .description("既存 Issue をプロジェクトに追加")
        .option("-s, --field-status <status>", "Status フィールドを設定")
        .option("--priority <priority>", "Priority フィールドを設定 (Critical/High/Medium/Low)")
        .option("--field-priority <priority>", "(--priority のエイリアス)")
        .option("--size <size>", "Size フィールドを設定 (XS/S/M/L/XL)")
        .option("--field-size <size>", "(--size のエイリアス)")
        .action(async (target, localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        resolveFieldAliases(options);
        const { cmdAddIssue } = await import("./add-issue.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdAddIssue(target, options, logger));
    });
    // ---------------------------------------------------------------------------
    // workflows
    // ---------------------------------------------------------------------------
    projects
        .command("workflows")
        .description("ビルトイン自動化ワークフローの状態を表示")
        .action(async (localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdWorkflows } = await import("./workflows.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdWorkflows(options, logger));
    });
    // ---------------------------------------------------------------------------
    // setup-metrics
    // ---------------------------------------------------------------------------
    projects
        .command("setup-metrics")
        .description("メトリクス追跡用テキストフィールドを作成")
        .action(async (localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdSetupMetrics } = await import("./setup-metrics.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdSetupMetrics(options, logger));
    });
    // ---------------------------------------------------------------------------
    // setup
    // ---------------------------------------------------------------------------
    projects
        .command("setup")
        .description("Status/Priority/Size フィールドをセットアップ")
        .option("--lang <lang>", "フィールド説明の言語: en, ja")
        .option("--field-id <fieldId>", "Status フィールド ID")
        .option("--project-id <projectId>", "プロジェクト ID")
        .option("--status-only", "Status フィールドのみ更新")
        .option("--dry-run", "変更を実行せずプレビュー")
        .option("-f, --force", "破壊的更新を強制実行")
        .action(async (localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdSetup } = await import("./setup.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdSetup(options, logger));
    });
    // ---------------------------------------------------------------------------
    // create-project (disabled)
    // ---------------------------------------------------------------------------
    projects
        .command("create-project")
        .description("フィールドセットアップ付きでプロジェクトを作成 (現在無効)")
        .option("-t, --title <title>", "プロジェクトタイトル")
        .option("--lang <lang>", "フィールド説明の言語: en, ja")
        .option("--dry-run", "変更を実行せずプレビュー")
        .action((localOpts, command) => {
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const logger = createActionLogger(options);
        // NOTE: コマンドとして無効化済み（2026-03-03, Issue #1202）
        // GitHub API ではワークフロー有効化が不可のため Web UI 手動作成に移行。
        // コードは API 整備時の再有効化のため保持。See: Discussion #1199, Issue #1167
        logger.warn("create-project is currently disabled.");
        logger.info("Please create GitHub Projects via Web UI.");
        logger.info("Use `shirokuma-docs projects setup` to configure fields.");
        setExitCode(1);
    });
    return projects;
}
//# sourceMappingURL=index.js.map