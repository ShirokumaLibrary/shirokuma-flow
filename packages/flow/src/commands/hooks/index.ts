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

export function createHooksCommand(): Command {
  const hooks = new Command("hooks")
    .description("Hooks 管理 (evaluate, evaluate-stop, evaluate-subagent-stop)");

  // evaluate
  hooks
    .command("evaluate")
    .description("Evaluate a command against blocked-commands.json rules")
    .option("-c, --config <file>", "設定ファイルパス")
    .action(async (localOpts: { config?: string }) => {
      const { hooksEvaluateCommand } = await import("./evaluate.js");
      await hooksEvaluateCommand(localOpts.config);
    });

  // evaluate-stop
  hooks
    .command("evaluate-stop")
    .description("Evaluate chain completion on Stop hook")
    .action(async () => {
      const { hooksEvaluateStopCommand } = await import("./evaluate-stop.js");
      await hooksEvaluateStopCommand();
    });

  // evaluate-subagent-stop
  hooks
    .command("evaluate-subagent-stop")
    .description("Evaluate chain continuation on SubagentStop hook")
    .action(async () => {
      const { hooksEvaluateSubagentStopCommand } = await import("./evaluate-subagent-stop.js");
      await hooksEvaluateSubagentStopCommand();
    });

  return hooks;
}

// Re-export for backward compatibility with tests
export { hooksEvaluateCommand, loadBlockedCommands, filterActiveRules, stripHeredocs, stripCodeBlocks, stripQuotedStrings, evaluateCommand } from "./evaluate.js";
export { hooksEvaluateStopCommand } from "./evaluate-stop.js";
export { hooksEvaluateSubagentStopCommand, resolveMainTranscriptPath } from "./evaluate-subagent-stop.js";
export { isChainStep, findLatestTasks, findLatestTodoWrite, findIncompleteChainSteps, findAllIncompleteTodos } from "./helpers.js";
