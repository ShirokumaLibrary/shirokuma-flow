/**
 * git command - Commander.js nested subcommand factory
 *
 * Creates the top-level `git` Command with subcommands registered.
 *
 * Usage in index.ts:
 *   import { createGitCommand } from "./commands/git/index.js";
 *   program.addCommand(createGitCommand());
 */
import { Command } from "commander";
export declare function createGitCommand(): Command;
//# sourceMappingURL=index.d.ts.map