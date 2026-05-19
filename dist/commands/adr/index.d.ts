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
import { Command } from "commander";
export declare function createAdrCommand(): Command;
export { cmdCreate } from "./create.js";
export { cmdList } from "./list.js";
export { cmdGet } from "./get.js";
export type { AdrOptions } from "./create.js";
//# sourceMappingURL=index.d.ts.map