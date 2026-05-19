/**
 * generate command - Commander.js nested subcommand factory
 *
 * Creates the top-level `generate` Command with all doc-generation subcommands registered.
 * Each subcommand imports its handler dynamically in the action handler.
 *
 * Usage in cli.ts:
 *   import { createGenerateCommand } from "./commands/index.js";
 *   program.addCommand(createGenerateCommand());
 */
import { Command } from "commander";
export declare function createGenerateCommand(): Command;
//# sourceMappingURL=index.d.ts.map