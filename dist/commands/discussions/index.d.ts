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
import { Command } from "commander";
export declare function createDiscussionsCommand(): Command;
//# sourceMappingURL=index.d.ts.map