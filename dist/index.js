#!/usr/bin/env node
/**
 * shirokuma-docs - Next.js プロジェクト用ドキュメント自動生成 CLI
 *
 * 機能:
 * - TypeDoc API ドキュメント生成
 * - Drizzle ORM スキーマから DBML/SVG 生成
 * - dependency-cruiser による依存関係グラフ
 * - Jest/Playwright テストケース一覧
 * - ポータル HTML 生成
 */
// Commander.js action callbacks receive opts as any; types are cast at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import { initCommand, InitError } from "./commands/init.js";
import { createLintCommand } from "./commands/lint/index.js";
// adr コマンドは discussion adr に昇格済み (#2219 Phase 5-4)
import { createGenerateCommand } from "./commands/generate/index.js";
import { createProjectsCommand } from "./commands/projects/index.js";
// issues コマンドは items に完全統合済み (#1814)
// pr コマンドは pr トップレベルに昇格済み (#2218 Phase 5-3)
// discussions コマンドは discussion トップレベルに昇格済み (#2219 Phase 5-4)
import { createRepoCommand } from "./commands/repo/index.js";
// shirokuma-md is optional - loaded dynamically below
// repo-pairs: migrated to ./commands/repo/pairs/ (accessed via `repo pairs` subcommand)
import { updateSkillsCommand } from "./commands/update-skills.js";
import { pluginInstallLocalCommand } from "./commands/plugin-install-local.js";
// session コマンドは完全削除済み (#1837) — items サブコマンドに移行完了
import { createGitCommand } from "./commands/git/index.js";
// search コマンドは items search に完全統合済み (#1818)
import { createHooksCommand } from "./commands/hooks/index.js";
import { createRulesCommand } from "./commands/rules/index.js";
import { createSkillsCommand } from "./commands/skills.js";
import { createSkillCommand } from "./commands/skill/index.js";
import { createDocsCommand } from "./commands/docs/index.js";
// items コマンドは責務別カテゴリへ完全分割済み (#2222 Phase 5-7)
import { createIssueCommand } from "./commands/issue/index.js";
import { createPrCommand } from "./commands/pr/index.js";
import { createDiscussionCommand } from "./commands/discussion/index.js";
import { createProjectCommand } from "./commands/project/index.js";
import { createStatusCommand } from "./commands/status/index.js";
import { setExitCode } from "./utils/cli-helpers.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initI18n } from "./utils/i18n.js";
import { applyColorControl } from "./utils/logger.js";
import { describeCommand, describeProgram, } from "./utils/describe.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
const program = new Command();
program
    .name("shirokuma-docs")
    .description("Next.js プロジェクト用ドキュメント自動生成 CLI")
    .version(packageJson.version)
    .option("--locale <locale>", "CLI 出力言語 (en, ja)")
    .option("--no-color", "色出力を無効化（NO_COLOR / CI 環境変数でも自動無効化）")
    .option("--color", "色出力を強制有効化（NO_COLOR / CI 環境変数を上書き）")
    .option("--describe", "コマンドの入力スキーマを JSON で出力");
// Initialize i18n and color control before command execution
program.hook("preAction", (_thisCommand, actionCommand) => {
    const opts = program.opts();
    initI18n(opts.locale);
    applyColorControl(opts, program.getOptionValueSource("color"));
    // --describe: コマンドスキーマを JSON 出力して終了
    if (opts.describe) {
        const schema = describeCommand(actionCommand, { includeInherited: true });
        process.stdout.write(JSON.stringify(schema, null, 2) + "\n");
        process.exit(0);
    }
});
// ドキュメント生成 (Commander.js ネストサブコマンド)
program.addCommand(createGenerateCommand());
// 設定ファイル初期化
program
    .command("init")
    .description("設定ファイルを初期化（オプションでスキル/ルールをインストール）")
    .option("-p, --project <path>", "プロジェクトパス", process.cwd())
    .option("-f, --force", "スキル/ルールを強制再デプロイ")
    .option("--with-skills [skills]", "スキルをインストール（カンマ区切りで指定、または全スキル）")
    .option("--with-rules", "ルールをインストール")
    .option("--lang <lang>", "言語設定 (en|ja) - .claude/settings.json に書き込み")
    .option("--channel <channel>", "プラグインリリースチャンネル (stable|rc|beta|alpha)")
    .option("--nextjs", "Next.js モノレポ構造をスキャフォールド")
    .option("--with-nextjs", "shirokuma-nextjs プラグインをインストール")
    .option("--no-gitignore", ".gitignore の自動更新をスキップ")
    .option("-v, --verbose", "詳細ログを出力")
    .action(async (options) => {
    try {
        await initCommand(options);
    }
    catch (error) {
        if (error instanceof InitError) {
            setExitCode(1);
            return;
        }
        throw error;
    }
});
// スキル/ルール更新
program
    .command("update-skills")
    .description("CLI本体・スキル・ルールを最新版に更新")
    .option("-p, --project <path>", "プロジェクトパス", process.cwd())
    .option("--with-rules", "ルールも更新")
    .option("--sync", "新スキル追加・旧スキル削除を検出（ルール同期も含む）")
    .option("--yes", "削除操作を確認なしで実行")
    .option("--dry-run", "プレビュー（実際には更新しない）")
    .option("-f, --force", "ローカル変更を無視して強制更新")
    .option("--install-cache", "グローバルキャッシュを強制更新（claude plugin uninstall + install）")
    .option("--channel <channel>", "プラグインリリースチャンネル (stable|rc|beta|alpha)")
    .option("-v, --verbose", "詳細ログを出力")
    .action(async (options) => {
    setExitCode(await updateSkillsCommand(options));
});
// スキル/ルール更新（短縮コマンド）
program
    .command("update")
    .description("CLI本体・スキル・ルールを最新版に更新（update-skills --sync の短縮形）")
    .option("-p, --project <path>", "プロジェクトパス", process.cwd())
    .option("--dry-run", "プレビュー（実際には更新しない）")
    .option("-f, --force", "ローカル変更を無視して強制更新")
    .option("--yes", "削除操作を確認なしで実行")
    .option("--install-cache", "グローバルキャッシュを強制更新（claude plugin uninstall + install）")
    .option("--channel <channel>", "プラグインリリースチャンネル (stable|rc|beta|alpha)")
    .option("-v, --verbose", "詳細ログを出力")
    .action(async (options) => {
    setExitCode(await updateSkillsCommand({ ...options, sync: true }));
});
// ローカルプラグインをグローバルキャッシュにインストール
program
    .command("plugin-install-local")
    .description("ローカルの plugin/ ディレクトリをグローバルキャッシュにインストールしてルールを展開")
    .option("-p, --project <path>", "プロジェクトパス", process.cwd())
    .option("--plugin <name>", "インストールするプラグイン名（省略時は言語設定から自動選択）")
    .option("--all", "全プラグインをインストール")
    .option("--dry-run", "プレビュー（実際には変更しない）")
    .option("-v, --verbose", "詳細ログを出力")
    .action((options) => {
    setExitCode(pluginInstallLocalCommand(options));
});
// 検証 (Commander.js ネストサブコマンド)
program.addCommand(createLintCommand());
// ADR / PR / discussions / search は items に完全統合済み (#1818)
// GitHub Projects V2 管理 (Commander.js ネストサブコマンド)
program.addCommand(createProjectsCommand());
// issues コマンドは items に完全統合済み (#1814)
// GitHub Repository 情報 (Commander.js ネストサブコマンド)
program.addCommand(createRepoCommand());
// session コマンドは完全削除済み (#1837) — items dashboard/integrity/preflight/update-status に移行
// Git 状態管理 (check)
program.addCommand(createGitCommand());
// discussion-templates: migrated to `discussions templates` subcommand (see createDiscussionsCommand)
// Public/Private リポジトリペア管理: migrated to `repo pairs` subcommand (see createRepoCommand)
// Hooks 評価 CLI (Commander.js ネストサブコマンド)
program.addCommand(createHooksCommand());
// ルール管理 (inject)
program.addCommand(createRulesCommand());
// スキル管理 (routing)
program.addCommand(createSkillsCommand());
// スキル管理 (init, validate, package, eval, optimize, benchmark)
program.addCommand(createSkillCommand());
// ドキュメント管理 (fetch, search, list, remove)
program.addCommand(createDocsCommand());
// Issue 専用コマンド (#2217 Phase 5-2)
program.addCommand(createIssueCommand());
// PR 専用コマンド (#2218 Phase 5-3)
program.addCommand(createPrCommand());
// Discussion / ADR 専用コマンド (#2219 Phase 5-4)
program.addCommand(createDiscussionCommand());
// Project V2 専用コマンド (#2220 Phase 5-5)
program.addCommand(createProjectCommand());
program.addCommand(createStatusCommand());
// ダッシュボード - アクティブ Issue/PR + git 状態の一括取得 (#2221 Phase 5-6)
program
    .command("dashboard")
    .description("アクティブ Issue/PR + git 状態を一括取得")
    .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
    .option("--format <format>", "出力形式: json, table-json", "json")
    .option("--team", "チームダッシュボード: 全メンバーの Issue を担当者別に表示")
    .option("-v, --verbose", "詳細ログ出力")
    .action(async (options) => {
    const { cmdDashboard } = await import("./commands/items/dashboard/index.js");
    const { createActionLogger } = await import("./utils/cli-helpers.js");
    const logger = createActionLogger(options);
    setExitCode(await cmdDashboard(options, logger));
});
// プリフライト - セッション終了前のデータを一括取得 (#2221 Phase 5-6)
program
    .command("preflight")
    .description("セッション終了前のデータを一括取得")
    .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
    .option("-v, --verbose", "詳細ログ出力")
    .action(async (options) => {
    const { cmdPreflight } = await import("./commands/items/preflight/index.js");
    const { createActionLogger } = await import("./utils/cli-helpers.js");
    const logger = createActionLogger(options);
    setExitCode(await cmdPreflight(options, logger));
});
// 整合性チェック - Issue 状態と Project Status の整合性チェック (#2221 Phase 5-6)
program
    .command("integrity")
    .description("Issue 状態と Project Status の整合性をチェック")
    .option("--owner <owner>", "リポジトリオーナー (デフォルト: 現在のリポジトリ)")
    .option("--fix", "不整合を自動修正")
    .option("--setup", "GitHub 手動設定の検証")
    .option("-v, --verbose", "詳細ログ出力")
    .action(async (options) => {
    const { cmdIntegrity } = await import("./commands/items/integrity/index.js");
    const { createActionLogger } = await import("./utils/cli-helpers.js");
    const logger = createActionLogger(options);
    setExitCode(await cmdIntegrity(options, logger));
});
// LLM 最適化 Markdown 管理（shirokuma-md 統合済み）
import { createMdCommand } from "./commands/md/program.js";
program.addCommand(createMdCommand());
// --describe をサブコマンドなしで使用した場合: トップレベル一覧を出力
// NOTE: Commander.js の preAction フックはサブコマンドが指定されたときのみ発火するため、
// トップレベル（サブコマンドなし）の --describe 検出は program.parse() 前に process.argv を
// 直接走査する必要がある。Commander.js の制約上の妥協点。
if (process.argv.includes("--describe")) {
    const commandNames = new Set(program.commands.map((c) => c.name()));
    const hasSubcommand = process.argv.slice(2).some((arg) => commandNames.has(arg));
    if (!hasSubcommand) {
        const schema = describeProgram(program, packageJson.version);
        process.stdout.write(JSON.stringify(schema, null, 2) + "\n");
        process.exit(0);
    }
}
program.parse();
//# sourceMappingURL=index.js.map