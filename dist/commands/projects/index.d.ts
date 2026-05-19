/**
 * projects command - Commander.js nested subcommand factory
 *
 * Creates the top-level `projects` Command with all subcommands registered.
 * Each subcommand imports its handler dynamically in the action handler.
 *
 * Phase 5-5 以降、`project` トップレベルカテゴリへの deprecation alias として機能する (#2220)。
 * 新規コードは `project` コマンドを使用すること。
 *
 * Usage in index.ts:
 *   import { createProjectsCommand } from "./commands/projects/index.js";
 *   program.addCommand(createProjectsCommand());
 */
import { Command } from "commander";
export declare function createProjectsCommand(): Command;
//# sourceMappingURL=index.d.ts.map