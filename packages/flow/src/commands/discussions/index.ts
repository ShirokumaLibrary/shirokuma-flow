/**
 * discussions command - Commander.js nested subcommand factory
 *
 * Creates the top-level `discussions` Command with all subcommands registered.
 * Each subcommand imports its handler dynamically in the action handler.
 *
 * Usage in index.ts:
 *   import { createDiscussionsCommand } from "./commands/discussions/index.js";
 *   program.addCommand(createDiscussionsCommand());
 */

// Commander.js action callbacks receive localOpts as any; parent opts cast via as at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import { createTemplatesCommand } from "./templates/index.js";
import { createActionLogger, setExitCode, mergeCommanderOpts as mergeOpts } from "../../utils/cli-helpers.js";


// =============================================================================
// Factory Function
// =============================================================================

export function createDiscussionsCommand(): Command {
  const discussions = new Command("discussions")
    .description(
      "GitHub Discussions 管理 (categories, list, show, search, templates)"
    );

  // Common parent options (available to all subcommands via command.parent?.opts())
  discussions
    .option("--category <category>", "カテゴリ名 (list/create/search 用)")
    .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
    .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
    .option("-v, --verbose", "詳細ログ出力");

  // ---------------------------------------------------------------------------
  // categories
  // ---------------------------------------------------------------------------
  discussions
    .command("categories")
    .description("利用可能な Discussion カテゴリを一覧表示")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdCategories } = await import("./categories.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdCategories(options, logger));
    });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  discussions
    .command("list")
    .description("Discussion を一覧表示 (カテゴリでフィルタ可)")
    .option("--limit <number>", "最大取得件数 (デフォルト: 20)", parseInt)
    .option("--format <format>", "出力形式: json, table-json", "table-json")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdList } = await import("./list.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdList(options, logger));
    });

  // ---------------------------------------------------------------------------
  // show
  // ---------------------------------------------------------------------------
  discussions
    .command("show <number>")
    .description("Discussion の詳細を取得")
    .option("--format <format>", "出力形式: json, frontmatter (デフォルト: frontmatter)")
    .option("--to-file <file>", "frontmatter 形式でファイルに出力（- で stdout）")
    .action(async (number, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdGet } = await import("./show.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdGet(number, options, logger));
    });

  // ---------------------------------------------------------------------------
  // search
  // ---------------------------------------------------------------------------
  discussions
    .command("search <query>")
    .description("Discussion をキーワード検索")
    .option("--limit <number>", "最大取得件数 (デフォルト: 20)", parseInt)
    .option("--format <format>", "出力形式: json, table-json", "table-json")
    .action(async (query, localOpts, command: Command) => {
      const options = mergeOpts(command, { ...localOpts, query });
      const { cmdSearch } = await import("./search.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdSearch(options, logger));
    });

  // ---------------------------------------------------------------------------
  // templates (nested subcommand group)
  // ---------------------------------------------------------------------------
  discussions.addCommand(createTemplatesCommand());

  return discussions;
}
