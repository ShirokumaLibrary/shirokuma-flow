/**
 * repo pairs command - Commander.js nested subcommand factory
 *
 * Creates the `pairs` subcommand group under `repo` with all pairs subcommands registered.
 * Each subcommand imports its handler dynamically in the action handler.
 *
 * Usage in repo/index.ts:
 *   import { createPairsCommand } from "./pairs/index.js";
 *   repo.addCommand(createPairsCommand());
 */

// Commander.js action callbacks receive localOpts as any; parent opts cast via as at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { Command } from "commander";
import { createPairsLogger } from "./helpers.js";
import { setExitCode, mergeCommanderOpts as mergeOpts } from "../../../utils/cli-helpers.js";


// =============================================================================
// Factory Function
// =============================================================================

export function createPairsCommand(): Command {
  const pairs = new Command("pairs")
    .description("Public/Private リポジトリペア管理 (list, init, status, release, templates)");

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  pairs
    .command("list")
    .description("Show all configured repo pairs")
    .action(async (_localOpts, command: Command) => {
      const options = mergeOpts(command, {});
      const logger = createPairsLogger(options.verbose);
      const { cmdList } = await import("./list.js");
      setExitCode(cmdList(logger));
    });

  // ---------------------------------------------------------------------------
  // init
  // ---------------------------------------------------------------------------
  pairs
    .command("init <alias>")
    .description("Initialize a repo pair in config")
    .option("--private <repo>", "Private リポジトリ (owner/name)")
    .option("--public <repo>", "Public リポジトリ (owner/name)")
    .option("--exclude <patterns...>", "リリース時の除外パターン")
    .option("--source-dir <dir>", "ソースディレクトリ")
    .action(async (alias, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const logger = createPairsLogger(options.verbose);
      const { cmdInit } = await import("./init.js");
      setExitCode(await cmdInit(alias, options, logger));
    });

  // ---------------------------------------------------------------------------
  // status
  // ---------------------------------------------------------------------------
  pairs
    .command("status [alias]")
    .description("Show sync status between repos")
    .action(async (alias, _localOpts, command: Command) => {
      const options = mergeOpts(command, {});
      const logger = createPairsLogger(options.verbose);
      const { cmdStatus } = await import("./status.js");
      setExitCode(await cmdStatus(alias, options, logger));
    });

  // ---------------------------------------------------------------------------
  // release
  // ---------------------------------------------------------------------------
  pairs
    .command("release <alias>")
    .description("Release to public repo")
    .option("--tag <version>", "リリースタグ")
    .option("--dry-run", "変更せずにプレビュー")
    .action(async (alias, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const logger = createPairsLogger(options.verbose);
      const { cmdRelease } = await import("./release.js");
      setExitCode(await cmdRelease(alias, options, logger));
    });

  // ---------------------------------------------------------------------------
  // templates
  // ---------------------------------------------------------------------------
  pairs
    .command("templates <alias>")
    .description("Generate public repo Issue templates")
    .action(async (alias, _localOpts, command: Command) => {
      const options = mergeOpts(command, {});
      const logger = createPairsLogger(options.verbose);
      const { cmdTemplates } = await import("./templates.js");
      setExitCode(cmdTemplates(alias, options, logger));
    });

  return pairs;
}
