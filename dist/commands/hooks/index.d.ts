/**
 * hooks command - Commander.js nested subcommand factory
 *
 * Creates the top-level `hooks` Command with all subcommands registered.
 *
 * Usage in index.ts:
 *   import { createHooksCommand } from "./commands/hooks/index.js";
 *   program.addCommand(createHooksCommand());
 */
import { Command } from "commander";
export declare function createHooksCommand(): Command;
export { hooksEvaluateCommand, loadBlockedCommands, filterActiveRules, stripHeredocs, stripCodeBlocks, stripQuotedStrings, evaluateCommand } from "./evaluate.js";
export { hooksEvaluateStopCommand } from "./evaluate-stop.js";
export { hooksEvaluateSubagentStopCommand, resolveMainTranscriptPath } from "./evaluate-subagent-stop.js";
export { isChainStep, findLatestTasks, findLatestTodoWrite, findIncompleteChainSteps, findAllIncompleteTodos } from "./helpers.js";
//# sourceMappingURL=index.d.ts.map