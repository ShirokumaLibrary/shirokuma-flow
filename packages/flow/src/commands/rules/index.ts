/**
 * rules command - Commander.js nested subcommand factory
 *
 * Creates the top-level `rules` Command with all subcommands registered.
 *
 * Usage in index.ts:
 *   import { createRulesCommand } from "./commands/rules/index.js";
 *   program.addCommand(createRulesCommand());
 */

import { Command } from "commander";

export function createRulesCommand(): Command {
  const rules = new Command("rules").description("ルール管理");

  rules
    .command("inject")
    .description("スコープに基づいてルールを stdout に注入")
    .requiredOption("--scope <scope>", "注入対象スコープ (例: main, commit-worker, coding-worker)")
    .option("--category <category>", "カテゴリフィルタ (例: github, general, shirokuma-flow)")
    .option("--priority <priority>", "優先度フィルタ (required|recommended)")
    .option("--lang <lang>", "言語 (en|ja)")
    .option("--max-tokens <number>", "出力上限トークン数", parseInt)
    .option("-p, --project <path>", "プロジェクトパス", process.cwd())
    .action(async (options: {
      scope: string;
      category?: string;
      priority?: string;
      lang?: string;
      maxTokens?: number;
      project: string;
    }) => {
      const { rulesInjectCommand } = await import("./inject.js");
      await rulesInjectCommand(options);
    });

  return rules;
}
