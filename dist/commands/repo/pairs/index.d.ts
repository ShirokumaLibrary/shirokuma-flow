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
import { Command } from "commander";
export declare function createPairsCommand(): Command;
//# sourceMappingURL=index.d.ts.map