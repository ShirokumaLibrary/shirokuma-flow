// Commander.js action callbacks receive localOpts as any; parent opts cast via as at boundary.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Command } from "commander";
import { createActionLogger, setExitCode, mergeCommanderOpts as mergeOpts } from "../../../utils/cli-helpers.js";


export function createTemplatesCommand(): Command {
  const templates = new Command("templates")
    .description("Discussion template management (generate, list-languages, add-language)");

  // ---------------------------------------------------------------------------
  // generate
  // ---------------------------------------------------------------------------
  templates
    .command("generate")
    .description("Generate discussion templates for a specific language")
    .option("-l, --lang <lang>", "Language code", "en")
    .option("-o, --output <dir>", "Output directory", ".github/DISCUSSION_TEMPLATE")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdGenerate } = await import("./generate.js");
      const logger = createActionLogger(options);
      setExitCode(cmdGenerate(options, logger));
    });

  // ---------------------------------------------------------------------------
  // list-languages
  // ---------------------------------------------------------------------------
  templates
    .command("list-languages")
    .description("List available template languages")
    .action(async (localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdListLanguages } = await import("./generate.js");
      const logger = createActionLogger(options);
      setExitCode(cmdListLanguages(options, logger));
    });

  // ---------------------------------------------------------------------------
  // add-language
  // ---------------------------------------------------------------------------
  templates
    .command("add-language <code>")
    .description("Add a new template language")
    .action(async (code, localOpts, command: Command) => {
      const options = mergeOpts(command, localOpts);
      const { cmdAddLanguage } = await import("./generate.js");
      const logger = createActionLogger(options);
      setExitCode(cmdAddLanguage(code, options, logger));
    });

  return templates;
}
