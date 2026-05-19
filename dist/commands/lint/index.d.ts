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
import { Command } from "commander";
export declare function createLintCommand(): Command;
//# sourceMappingURL=index.d.ts.map