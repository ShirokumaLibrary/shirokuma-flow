/**
 * adr command - Commander.js nested subcommand factory
 *
 * Creates the top-level `adr` Command with all subcommands registered.
 * ADRs are stored in GitHub Discussions (ADR category).
 *
 * Usage in index.ts:
 *   import { createAdrCommand } from "./commands/adr/index.js";
 *   program.addCommand(createAdrCommand());
 */

// Commander.js action callbacks receive localOpts as any; parent opts cast via as at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import { createLogger } from "../../utils/logger.js";
import { setExitCode, mergeCommanderOpts as mergeOpts } from "../../utils/cli-helpers.js";


export function createAdrCommand(): Command {
  const adr = new Command("adr")
    .description("ADR 管理 via GitHub Discussions (create, list, get)");

  adr
    .option("--public", "公開リポジトリを対象 (repoPairs 設定から)")
    .option("--repo <alias>", "クロスリポジトリのエイリアス (crossRepos 設定から)")
    .option("-v, --verbose", "詳細ログ出力");

  // create
  adr
    .command("create <title>")
    .description("新しい ADR Discussion を作成")
    .action(async (title: string, _localOpts, command: Command) => {
      const options = mergeOpts(command, {});
      const logger = createLogger(options.verbose);
      const { cmdCreate } = await import("./create.js");
      setExitCode(await cmdCreate(title, options, logger));
    });

  // list
  adr
    .command("list")
    .description("ADR Discussion を一覧表示")
    .option("--limit <number>", "最大取得件数 (デフォルト: 20)", parseInt)
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdList } = await import("./list.js");
      setExitCode(await cmdList(options));
    });

  // get
  adr
    .command("get <number>")
    .description("ADR Discussion の詳細を取得")
    .action(async (target: string, _localOpts, command: Command) => {
      const options = mergeOpts(command, {});
      const { cmdGet } = await import("./get.js");
      setExitCode(await cmdGet(target, options));
    });

  return adr;
}

// Re-export for backward compatibility with tests
export { cmdCreate } from "./create.js";
export { cmdList } from "./list.js";
export { cmdGet } from "./get.js";
export type { AdrOptions } from "./create.js";
