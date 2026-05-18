/**
 * lint command - Commander.js nested subcommand factory
 *
 * Creates the top-level `lint` Command with all validation subcommands registered.
 * Each subcommand imports its handler dynamically in the action handler.
 *
 * Usage in index.ts:
 *   import { createLintCommand } from "./commands/lint/index.js";
 *   program.addCommand(createLintCommand());
 */

// Commander.js mergeCommanderOpts returns a merged options object typed via as-cast at the boundary.
// Dynamic imports mean each sub-option type is not statically known here.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import { setExitCode, mergeCommanderOpts as mergeOpts } from "../../utils/cli-helpers.js";
import { validateProjectPath } from "../../utils/sanitize.js";
import { CONFIG_FILE } from "../../utils/config.js";

// =============================================================================
// Factory Function
// =============================================================================

export function createLintCommand(): Command {
  const lint = new Command("lint")
    .description(
      "検証 (all, tests, coverage, docs, code, annotations, structure, workflow, security)"
    );

  // Common parent options (available to all subcommands via command.parent?.opts())
  lint
    .option("-p, --project <path>", "プロジェクトパス", process.cwd())
    .option("-c, --config <file>", "設定ファイルパス", CONFIG_FILE)
    .option("-f, --format <format>", "出力フォーマット (terminal, json, summary)", "terminal")
    .option("-o, --output <file>", "出力ファイルパス")
    .option("-s, --strict", "strictモード（エラーがあれば exit code 1）")
    .option("-v, --verbose", "詳細ログ出力");

  // パストラバーサル対策: 全サブコマンドの実行前にプロジェクトパスを検証
  lint.hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.project) {
      opts.project = validateProjectPath(opts.project);
    }
  });

  // ---------------------------------------------------------------------------
  // all (default: runs when `lint` is called without subcommand)
  // ---------------------------------------------------------------------------
  lint
    .command("all", { isDefault: true })
    .description("全ての lint を一括実行")
    .action(async (_localOpts, command: Command) => {
      const options = mergeOpts(command, {});
      const { cmdLintAll } = await import("./all.js");
      setExitCode(await cmdLintAll(options));
    });

  // ---------------------------------------------------------------------------
  // tests
  // ---------------------------------------------------------------------------
  lint
    .command("tests")
    .description("テストドキュメント (@testdoc) をチェック")
    .option("--coverage-threshold <number>", "最小カバレッジ閾値 (%)", parseInt)
    .option("-i, --ignore <patterns...>", "無視するパターン")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { lintTestsCommand } = await import("./tests.js");
      setExitCode(await lintTestsCommand(options));
    });

  // ---------------------------------------------------------------------------
  // coverage
  // ---------------------------------------------------------------------------
  lint
    .command("coverage")
    .description("実装ファイルとテストファイルの対応をチェック")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { lintCoverageCommand } = await import("./coverage.js");
      setExitCode(lintCoverageCommand(options));
    });

  // ---------------------------------------------------------------------------
  // docs
  // ---------------------------------------------------------------------------
  lint
    .command("docs")
    .description("ドキュメント構造（OVERVIEW.md, ADR等）を検証")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { lintDocsCommand } = await import("./docs.js");
      setExitCode(lintDocsCommand(options));
    });

  // ---------------------------------------------------------------------------
  // code
  // ---------------------------------------------------------------------------
  lint
    .command("code")
    .description("コード構造（Server Actions の JSDoc タグ等）を検証")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { lintCodeCommand } = await import("./code.js");
      setExitCode(lintCodeCommand(options));
    });

  // ---------------------------------------------------------------------------
  // annotations
  // ---------------------------------------------------------------------------
  lint
    .command("annotations")
    .description("アノテーション整合性（@usedComponents, @screen, @component）を検証")
    .option("--fix", "アノテーションの問題を自動修正")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { lintAnnotationsCommand } = await import("./annotations.js");
      setExitCode(lintAnnotationsCommand(options));
    });

  // ---------------------------------------------------------------------------
  // structure
  // ---------------------------------------------------------------------------
  lint
    .command("structure")
    .description("プロジェクト構造（ディレクトリ構成、命名規則等）を検証")
    .option("-f, --format <format>", "出力フォーマット (yaml, json, terminal)", "yaml")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { lintStructureCommand } = await import("./structure.js");
      setExitCode(lintStructureCommand(options));
    });

  // ---------------------------------------------------------------------------
  // workflow
  // ---------------------------------------------------------------------------
  lint
    .command("workflow")
    .description("AI ワークフロー規約（Issue フィールド、ブランチ命名、保護ブランチ）を検証")
    .option("--issues", "Issue フィールドのみチェック")
    .option("--branches", "ブランチ命名のみチェック")
    .option("--commits", "コミット規約のみチェック")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { lintWorkflowCommand } = await import("./workflow.js");
      setExitCode(await lintWorkflowCommand(options));
    });

  // ---------------------------------------------------------------------------
  // security
  // ---------------------------------------------------------------------------
  lint
    .command("security")
    .description("依存パッケージの脆弱性をチェック")
    .option("--severity <level>", "最小severity閾値 (critical, high, moderate, low)", "high")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { lintSecurityCommand } = await import("./security.js");
      setExitCode(await lintSecurityCommand(options));
    });

  return lint;
}
