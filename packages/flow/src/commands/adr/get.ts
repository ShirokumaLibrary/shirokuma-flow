/**
 * adr get - Get ADR Discussion details
 */

import { createActionLogger } from "../../utils/cli-helpers.js";
import type { DiscussionsOptions } from "../discussions/helpers.js";
import { cmdGet as discussionsGet } from "../discussions/show.js";
import type { AdrOptions } from "./create.js";

/**
 * get subcommand handler
 */
export async function cmdGet(
  target: string,
  options: AdrOptions,
): Promise<number> {
  const discOpts: DiscussionsOptions = {
    verbose: options.verbose,
    repo: options.repo,
    public: options.public,
  };
  const actionLogger = createActionLogger(discOpts as Record<string, unknown>);
  return discussionsGet(target, discOpts, actionLogger);
}
