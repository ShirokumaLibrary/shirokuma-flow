/**
 * repo command - Commander.js nested subcommand factory
 *
 * Creates the top-level `repo` Command with all subcommands registered.
 * Each subcommand imports its handler dynamically in the action handler.
 *
 * Usage in index.ts:
 *   import { createRepoCommand } from "./commands/repo/index.js";
 *   program.addCommand(createRepoCommand());
 */

// Commander.js action callbacks receive localOpts as any; parent opts cast via as at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import { createActionLogger, setExitCode, mergeCommanderOpts as mergeOpts } from "../../utils/cli-helpers.js";
import { createPairsCommand } from "./pairs/index.js";


// =============================================================================
// Factory Function
// =============================================================================

export function createRepoCommand(): Command {
  const repo = new Command("repo")
    .description("GitHub リポジトリ情報・管理 (info, labels, pairs)");

  // Common parent options (available to all subcommands via command.parent?.opts())
  repo
    .option("-v, --verbose", "詳細ログ出力");

  // ---------------------------------------------------------------------------
  // info
  // ---------------------------------------------------------------------------
  repo
    .command("info")
    .description("Get repository information")
    .action(async (_localOpts, command: Command) => {
      const options = mergeOpts(command, {});
      const logger = createActionLogger(options);
      const { cmdInfo } = await import("./info.js");
      setExitCode(await cmdInfo(options, logger));
    });

  // ---------------------------------------------------------------------------
  // labels
  // ---------------------------------------------------------------------------
  repo
    .command("labels")
    .description("List or create labels")
    .option("--create <name>", "Create a new label")
    .option("--color <color>", "Label color in hex (e.g., 'ff0000')")
    .option("--description <desc>", "Label description")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const logger = createActionLogger(options);
      const { cmdLabels } = await import("./labels.js");
      setExitCode(await cmdLabels(options, logger));
    });

  // ---------------------------------------------------------------------------
  // status
  // ---------------------------------------------------------------------------
  repo
    .command("status")
    .description("Check npm / GitHub service status")
    .action(async (_localOpts, command: Command) => {
      const options = mergeOpts(command, {});
      const logger = createActionLogger(options);
      const { cmdStatus } = await import("./status.js");
      setExitCode(await cmdStatus(options, logger));
    });

  // ---------------------------------------------------------------------------
  // pairs (subcommand group)
  // ---------------------------------------------------------------------------
  repo.addCommand(createPairsCommand());

  return repo;
}
