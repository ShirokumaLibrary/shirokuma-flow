#!/usr/bin/env node
/**
 * shirokuma-flow - Next.js プロジェクト用ドキュメント自動生成 CLI
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

import { Command, CommanderError } from "commander";
import { initCommand, InitError } from "./commands/init.js";
import { createLintCommand } from "./commands/lint/index.js";
// adr コマンドは discussion adr に昇格済み (#2219 Phase 5-4)
// sync-github は動的 import で登録（テスト時のモック分離のため）
// issues コマンドは items に完全統合済み (#1814)
// pr コマンドは pr トップレベルに昇格済み (#2218 Phase 5-3)
// discussions コマンドは discussion トップレベルに昇格済み (#2219 Phase 5-4)
import { createRepoCommand } from "./commands/repo/index.js";
// shirokuma-md is optional - loaded dynamically below
// repo-pairs: migrated to ./commands/repo/pairs/ (accessed via `repo pairs` subcommand)
import { updateSkillsCommand } from "./commands/update-skills.js";
import { pluginInstallLocalCommand } from "./commands/plugin-install-local.js";
import { createPluginCommand } from "./commands/plugin/index.js";
// session コマンドは完全削除済み (#1837) — items サブコマンドに移行完了
import { createGitCommand } from "./commands/git/index.js";
// search コマンドは items search に完全統合済み (#1818)
import { createHooksCommand } from "./commands/hooks/index.js";
import { createRulesCommand } from "./commands/rules/index.js";
import { createSkillsCommand } from "./commands/skills.js";
import { createSkillCommand } from "./commands/skill/index.js";
import { createIssueCommand } from "./commands/issue/index.js";
import { createPrCommand } from "./commands/pr/index.js";
import { createDiscussionCommand } from "./commands/discussion/index.js";
import { createProjectCommand } from "./commands/project/index.js";
import { createStatusCommand } from "./commands/status/index.js";
import { createBeginCommand } from "./commands/begin.js";
import { createSubmitCommand } from "./commands/submit.js";
import { createBlockCommand } from "./commands/block.js";
import { createResumeCommand } from "./commands/resume.js";
import { createApproveCommand } from "./commands/approve.js";
import { createRejectCommand } from "./commands/reject.js";
import { createCancelCommand } from "./commands/cancel.js";
import { setExitCode } from "./utils/cli-helpers.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initI18n } from "./utils/i18n.js";
import { applyColorControl } from "./utils/logger.js";
import {
  commandToJson,
  emitJson,
  errorToJson,
  isBenignCommanderError,
  preflightArgv,
  walkCommands,
} from "./lib/help-json.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8")
) as { version: string; description?: string };

const program = new Command();

program
  .name("shirokuma-flow")
  .description("Next.js プロジェクト用ドキュメント自動生成 CLI")
  .version(packageJson.version)
  .option("--locale <locale>", "CLI 出力言語 (en, ja)")
  .option("--no-color", "色出力を無効化（NO_COLOR / CI 環境変数でも自動無効化）")
  .option("--color", "色出力を強制有効化（NO_COLOR / CI 環境変数を上書き）");

// Initialize i18n and color control before command execution
program.hook("preAction", (_thisCommand, actionCommand) => {
  const opts = program.opts();
  initI18n(opts.locale);
  applyColorControl(opts, program.getOptionValueSource("color"));
});

// GitHub データ同期（generate github-data のトップレベル昇格版 #2495）
{
  const syncGithub = new Command("sync-github")
    .description("GitHub Issues/Discussions データを JSON 形式で生成")
    .option("-p, --project <path>", "プロジェクトパス", process.cwd())
    .option("-c, --config <file>", "設定ファイルパス")
    .option("-o, --output <dir>", "出力ディレクトリ")
    .option("-v, --verbose", "詳細ログ出力")
    .action(async (options) => {
      const { githubDataCommand } = await import("./commands/sync-github/index.js");
      try {
        await githubDataCommand(options as { project: string; output?: string; verbose?: boolean });
      } catch {
        setExitCode(1);
      }
    });
  program.addCommand(syncGithub);
}

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
    } catch (error) {
      if (error instanceof InitError) {
        setExitCode(1);
        return;
      }
      throw error;
    }
  });

// スキル/ルール更新（統合コマンド。update-skills の全オプションを受け付ける）
program
  .command("update")
  .description("CLI本体・スキル・ルールを最新版に更新（--sync はデフォルト有効）")
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
    // --sync を明示指定しない場合はデフォルト true（旧 update-skills --sync の挙動を継承）
    const sync = options.sync !== false;
    setExitCode(await updateSkillsCommand({ ...options, sync }));
  });

// ローカルプラグインをグローバルキャッシュにインストール
program
  .command("plugin-install-local")
  .description("ローカルの plugin/ ディレクトリをグローバルキャッシュにインストールしてルールを展開")
  .option("-p, --project <path>", "プロジェクトパス", process.cwd())
  .option("--plugin <name>", "インストールするプラグイン名（省略時は言語設定から自動選択）")
  .option("--all", "全プラグインをインストール")
  .option("--dry-run", "プレビュー（実際には変更しない）")
  .option(
    "--cleanup-rules",
    ".shirokuma/rules/shirokuma/ 配下の管理外ルール（過去 plugin リリースの orphan ファイル等）を削除する（デフォルト: 無効）",
  )
  .option("-v, --verbose", "詳細ログを出力")
  .action((options) => {
    setExitCode(pluginInstallLocalCommand(options));
  });

// プラグインチャネル切替 (Commander.js ネストサブコマンド) (#2647)
program.addCommand(createPluginCommand());

// 検証 (Commander.js ネストサブコマンド)
program.addCommand(createLintCommand());

// ADR / PR / discussions / search は items に完全統合済み (#1818)

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

// Issue 専用コマンド (#2217 Phase 5-2)
program.addCommand(createIssueCommand());

// PR 専用コマンド (#2218 Phase 5-3)
program.addCommand(createPrCommand());

// Discussion / ADR 専用コマンド (#2219 Phase 5-4)
program.addCommand(createDiscussionCommand());

// Project V2 専用コマンド (#2220 Phase 5-5)
program.addCommand(createProjectCommand());

program.addCommand(createStatusCommand());

// Workflow checkpoint コマンド: status transition + 関連操作を 1 コマンドにまとめた薄いラッパー
// AI がワークフローのチェックポイント単位で操作できるよう、status / issue の primitive を組み合わせる
program.addCommand(createBeginCommand());
program.addCommand(createSubmitCommand());
program.addCommand(createBlockCommand());
program.addCommand(createResumeCommand());
program.addCommand(createApproveCommand());
program.addCommand(createRejectCommand());
program.addCommand(createCancelCommand());

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
  .option("--format <format>", "出力フォーマット（text / json）", "text")
  .option("-v, --verbose", "詳細ログ出力")
  .action(async (options) => {
    const { cmdIntegrity } = await import("./commands/items/integrity/index.js");
    const { createActionLogger } = await import("./utils/cli-helpers.js");
    const logger = createActionLogger(options);
    setExitCode(await cmdIntegrity(options, logger));
  });

// preflightArgv から取得する pretty を describe action から参照するため、let で先行宣言する。
// describe action は parseAsync 中に呼ばれるため、その時点で代入済みの値が見える。
let pretty = false;

// describe サブコマンド: コマンドツリー全体を JSON でダンプ（AI ディスカバリー用）
// ADR-v3-019: 旧 --describe グローバルオプション機構は廃止し、サブコマンドに統一
program
  .command("describe")
  .description("Dump the entire command tree as JSON (AI discovery entry point)")
  .action(() => {
    emitJson(commandToJson(program, { deep: true }), { pretty });
  });

// JSON help / human help の統合（ADR-v3-019）
walkCommands(program, (cmd) => {
  cmd.helpOption(false);
  cmd.addHelpCommand(false);
  cmd.option("--help", "AI-readable JSON help (default for AI consumers)");
  cmd.option("--help-human, -H", "Human-readable text help (emergency only)");
  cmd.exitOverride();
  cmd.configureOutput({ writeOut: () => {}, writeErr: () => {}, outputError: () => {} });
});

const preflight = preflightArgv(process.argv, program);
pretty = preflight.pretty;
const { help, target, remainingArgv } = preflight;

if (help === "json") {
  emitJson(commandToJson(target), { pretty });
}
if (help === "human") {
  process.stdout.write(target.helpInformation());
  process.exit(0);
}
if (remainingArgv.length <= 2) {
  emitJson(commandToJson(program, { deep: true }), { pretty });
}

program.parseAsync(remainingArgv).catch((err: unknown) => {
  if (err instanceof CommanderError) {
    if (isBenignCommanderError(err)) {
      process.exit(err.exitCode ?? 0);
    }
    emitJson(errorToJson(err, target), { pretty, exitCode: 1 });
    return;
  }
  emitJson(errorToJson(err instanceof Error ? err : new Error(String(err))), {
    pretty,
    exitCode: 1,
  });
});
