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
import { Command } from "commander";
export declare function createRepoCommand(): Command;
//# sourceMappingURL=index.d.ts.map