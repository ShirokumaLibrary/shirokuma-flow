/**
 * discussion コマンド - Discussion + ADR 専用サブコマンドファクトリ (#2219 Phase 5-4, #2222 Phase 5-7)
 *
 * Discussion / ADR をトップレベルカテゴリで統合管理する。
 * ADR は `discussion adr` ネストとして配置。
 *
 * サブコマンド:
 * - `discussion add <file>`: Discussion を作成してキャッシュに移動
 * - `discussion categories`: 利用可能な Discussion カテゴリを一覧表示
 * - `discussion list`: Discussion を一覧表示
 * - `discussion show <number>`: Discussion の詳細を取得
 * - `discussion search <query>`: Discussion をキーワード検索
 * - `discussion templates`: Discussion テンプレートを生成
 * - `discussion adr create <title>`: ADR Discussion を作成
 * - `discussion adr list`: ADR Discussion を一覧表示
 * - `discussion adr get <number>`: ADR Discussion の詳細を取得
 */

// Commander.js action callbacks receive localOpts as any; parent opts cast via as at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import { createActionLogger, setExitCode, mergeCommanderOpts as mergeOpts } from "../../utils/cli-helpers.js";
import { createLogger } from "../../utils/logger.js";
import { createTemplatesCommand } from "../discussions/templates/index.js";

// =============================================================================
// Factory Function
// =============================================================================

export function createDiscussionCommand(): Command {
  const discussion = new Command("discussion")
    .description(
      "GitHub Discussions / ADR 管理 (categories, list, show, search, templates, adr)"
    );

  // 共通親オプション
  discussion
    .option("--category <category>", "カテゴリ名 (list/create/search 用)")
    .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
    .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
    .option("-v, --verbose", "詳細ログ出力");

  // ---------------------------------------------------------------------------
  // add
  // ---------------------------------------------------------------------------
  discussion
    .command("add <file>")
    .description("Discussion を作成してキャッシュに移動する（frontmatter から title/category を読み取り）。- で stdin")
    .action(async (file: string, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdAddDiscussion } = await import("../items/add/discussion.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdAddDiscussion(file, options, logger));
    });

  // ---------------------------------------------------------------------------
  // categories
  // ---------------------------------------------------------------------------
  discussion
    .command("categories")
    .description("利用可能な Discussion カテゴリを一覧表示")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdCategories } = await import("../discussions/categories.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdCategories(options, logger));
    });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  discussion
    .command("list")
    .description("Discussion を一覧表示 (カテゴリでフィルタ可)")
    .option("--limit <number>", "最大取得件数 (デフォルト: 20)", parseInt)
    .option("--format <format>", "出力形式: json, table-json", "table-json")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdList: cmdDiscussionsList } = await import("../discussions/list.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdDiscussionsList(options, logger));
    });

  // ---------------------------------------------------------------------------
  // show
  // ---------------------------------------------------------------------------
  discussion
    .command("show <number>")
    .description("Discussion の詳細を取得")
    .option("--format <format>", "出力形式: json, frontmatter (デフォルト: frontmatter)")
    .option("--to-file <file>", "frontmatter 形式でファイルに出力（- で stdout）")
    .action(async (number, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdGet } = await import("../discussions/show.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdGet(number, options, logger));
    });

  // ---------------------------------------------------------------------------
  // search
  // ---------------------------------------------------------------------------
  discussion
    .command("search <query>")
    .description("Discussion をキーワード検索")
    .option("--limit <number>", "最大取得件数 (デフォルト: 20)", parseInt)
    .option("--format <format>", "出力形式: json, table-json", "table-json")
    .action(async (query, localOpts, command: Command) => {
      const options = mergeOpts(command, { ...localOpts, query });
      const { cmdSearch: cmdDiscussionsSearch } = await import("../discussions/search.js");
      const logger = createActionLogger(options);
      setExitCode(await cmdDiscussionsSearch(options, logger));
    });

  // ---------------------------------------------------------------------------
  // templates ネストサブコマンドグループ
  // ---------------------------------------------------------------------------
  discussion.addCommand(createTemplatesCommand());

  // ---------------------------------------------------------------------------
  // adr ネストサブコマンドグループ
  // ---------------------------------------------------------------------------
  const adr = new Command("adr")
    .description("ADR 管理 via GitHub Discussions (create, list, get)");

  adr
    .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
    .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
    .option("-v, --verbose", "詳細ログ出力");

  adr
    .command("create <title>")
    .description("新しい ADR Discussion を作成")
    .action(async (title: string, _localOpts, command: Command) => {
      const options = mergeOpts(command, {});
      const logger = createLogger(options.verbose);
      const { cmdCreate } = await import("../adr/create.js");
      setExitCode(await cmdCreate(title, options, logger));
    });

  adr
    .command("list")
    .description("ADR Discussion を一覧表示")
    .option("--limit <number>", "最大取得件数 (デフォルト: 20)", parseInt)
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdList: cmdAdrList } = await import("../adr/list.js");
      setExitCode(await cmdAdrList(options));
    });

  adr
    .command("get <number>")
    .description("ADR Discussion の詳細を取得")
    .action(async (target: string, _localOpts, command: Command) => {
      const options = mergeOpts(command, {});
      const { cmdGet: cmdAdrGet } = await import("../adr/get.js");
      setExitCode(await cmdAdrGet(target, options));
    });

  discussion.addCommand(adr);

  return discussion;
}
