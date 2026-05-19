/**
 * items コマンド - Commander.js ネストサブコマンドファクトリ (#1776, #1810, #1814, #1818, #1820)
 *
 * Issue / Discussion / PR / ADR の統合管理コマンド。
 * Phase 5-2 以降、Issue 専用サブコマンドは `issue` カテゴリに移行済み。
 * Phase 5-3 以降、PR サブコマンドは `pr` トップレベルカテゴリに移行済み (#2218)。
 * Phase 5-4 以降、Discussion / ADR サブコマンドは `discussion` トップレベルカテゴリに移行済み (#2219)。
 * Phase 5-5 以降、Project V2 サブコマンドは `project` トップレベルカテゴリに移行済み (#2220)。
 * Phase 5-6 以降、dashboard / preflight / integrity はトップレベルに昇格済み (#2221)。
 *
 * 残存サブコマンド（items カテゴリ、deprecation alias として維持）:
 * - `items add discussion --file <file>`: Discussion を作成してキャッシュに移動
 * - `items projects`: `project` トップレベルへの deprecation alias
 * - `items integrity`: `integrity` トップレベルへの deprecation alias
 * - `items dashboard`: `dashboard` トップレベルへの deprecation alias
 * - `items preflight`: `preflight` トップレベルへの deprecation alias
 */
// Commander.js action callbacks receive localOpts as any; parent opts cast via as at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { Command } from "commander";
import { createActionLogger, setExitCode, resolveBodyFileOption } from "../../utils/cli-helpers.js";
// =============================================================================
// Factory Function
// =============================================================================
export function createItemsCommand() {
    const items = new Command("items")
        .description("Issue / Discussion 管理 (add discussion, integrity, dashboard, preflight)");
    // 共通親オプション
    items
        .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
        .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
        .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
        .option("-v, --verbose", "詳細ログ出力");
    // ---------------------------------------------------------------------------
    // add（ネストされたサブコマンドグループ）
    // add discussion のみ残存（add issue / add comment は issue カテゴリへ移行済み）
    // ---------------------------------------------------------------------------
    const add = new Command("add")
        .description("Discussion を新規作成してキャッシュに移動");
    add
        .command("discussion")
        .description("Discussion を作成してキャッシュに移動する（frontmatter から title/category を読み取り）")
        .option("--file <file>", "frontmatter 付き Markdown ファイルパス")
        .action(async (localOpts, command) => {
        const addOpts = command.parent?.opts() ?? {};
        const itemsOpts = command.parent?.parent?.opts() ?? {};
        const options = { ...itemsOpts, ...addOpts, ...localOpts };
        const { cmdAddDiscussion } = await import("./add/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdAddDiscussion(options, logger));
    });
    items.addCommand(add);
    // ---------------------------------------------------------------------------
    // projects サブコマンドグループ - deprecation alias → `project` トップレベルに移行 (#2220)
    // ---------------------------------------------------------------------------
    const projectsSub = new Command("projects")
        .description("[非推奨] `project` コマンドを使用してください。GitHub Projects V2 アイテム操作 (add-issue, update, delete)");
    projectsSub
        .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
        .option("--format <format>", "出力形式: json, table-json")
        .option("-v, --verbose", "詳細ログ出力");
    // deprecation 警告を preSubcommand フックで発火
    projectsSub.hook("preSubcommand", (_thisCommand, _subcommand) => {
        process.stderr.write("⚠ 'items projects' は非推奨です。代わりに 'project' を使用してください。\n");
    });
    // add-issue
    projectsSub
        .command("add-issue <target>")
        .description("既存 Issue をプロジェクトに追加")
        .option("-s, --field-status <status>", "Status フィールドを設定")
        .option("--priority <priority>", "Priority フィールドを設定 (Critical/High/Medium/Low)")
        .option("--field-priority <priority>", "(--priority のエイリアス)")
        .option("--size <size>", "Size フィールドを設定 (XS/S/M/L/XL)")
        .option("--field-size <size>", "(--size のエイリアス)")
        .action(async (target, localOpts, command) => {
        const projOpts = command.parent?.opts() ?? {};
        const itemsOpts = command.parent?.parent?.opts() ?? {};
        const options = { ...itemsOpts, ...projOpts, ...localOpts };
        // --field-priority / --field-size → --priority / --size エイリアス解決
        options.priority ??= options.fieldPriority;
        options.size ??= options.fieldSize;
        const { cmdAddIssue } = await import("../projects/add-issue.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdAddIssue(target, options, logger));
    });
    // update
    projectsSub
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
        const projOpts = command.parent?.opts() ?? {};
        const itemsOpts = command.parent?.parent?.opts() ?? {};
        const options = { ...itemsOpts, ...projOpts, ...localOpts };
        options.priority ??= options.fieldPriority;
        options.size ??= options.fieldSize;
        const { cmdUpdate } = await import("../projects/update.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdUpdate(target, options, logger));
    });
    // delete
    projectsSub
        .command("delete <target>")
        .description("プロジェクトからアイテムを削除")
        .option("-f, --force", "確認をスキップ")
        .action(async (target, localOpts, command) => {
        const projOpts = command.parent?.opts() ?? {};
        const itemsOpts = command.parent?.parent?.opts() ?? {};
        const options = { ...itemsOpts, ...projOpts, ...localOpts };
        const { cmdDelete } = await import("../projects/delete.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdDelete(target, options, logger));
    });
    items.addCommand(projectsSub);
    // ---------------------------------------------------------------------------
    // integrity - deprecation alias → `integrity` トップレベルに昇格 (#2221)
    // ---------------------------------------------------------------------------
    items
        .command("integrity")
        .description("[非推奨] `integrity` コマンドを使用してください。Issue 状態と Project Status の整合性をチェック")
        .option("--fix", "不整合を自動修正")
        .option("--setup", "GitHub 手動設定の検証")
        .action(async (localOpts, command) => {
        process.stderr.write("⚠ 'items integrity' は非推奨です。代わりに 'integrity' を使用してください。\n");
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdIntegrity } = await import("./integrity/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdIntegrity(options, logger));
    });
    // ---------------------------------------------------------------------------
    // dashboard - deprecation alias → `dashboard` トップレベルに昇格 (#2221)
    // ---------------------------------------------------------------------------
    items
        .command("dashboard")
        .description("[非推奨] `dashboard` コマンドを使用してください。アクティブ Issue/PR + git 状態を一括取得")
        .option("--format <format>", "出力形式: json, table-json", "json")
        .option("--team", "チームダッシュボード: 全メンバーの Issue を担当者別に表示")
        .action(async (localOpts, command) => {
        process.stderr.write("⚠ 'items dashboard' は非推奨です。代わりに 'dashboard' を使用してください。\n");
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdDashboard } = await import("./dashboard/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdDashboard(options, logger));
    });
    // ---------------------------------------------------------------------------
    // preflight - deprecation alias → `preflight` トップレベルに昇格 (#2221)
    // ---------------------------------------------------------------------------
    items
        .command("preflight")
        .description("[非推奨] `preflight` コマンドを使用してください。セッション終了前のデータを一括取得")
        .action(async (localOpts, command) => {
        process.stderr.write("⚠ 'items preflight' は非推奨です。代わりに 'preflight' を使用してください。\n");
        const parentOpts = (command.parent?.opts() ?? {});
        const options = { ...parentOpts, ...localOpts };
        const { cmdPreflight } = await import("./preflight/index.js");
        const logger = createActionLogger(options);
        setExitCode(await cmdPreflight(options, logger));
    });
    return items;
}
//# sourceMappingURL=index.js.map