/**
 * adr list - List ADR Discussions
 */

import { createActionLogger } from "../../utils/cli-helpers.js";
import type { DiscussionsOptions } from "../discussions/helpers.js";
import { cmdList as discussionsList } from "../discussions/list.js";
import { ADR_CATEGORY, type AdrOptions } from "./create.js";

/**
 * list subcommand handler
 */
export async function cmdList(options: AdrOptions): Promise<number> {
  const discOpts: DiscussionsOptions = {
    category: ADR_CATEGORY,
    limit: options.limit,
    verbose: options.verbose,
    repo: options.repo,
    public: options.public,
  };
  const actionLogger = createActionLogger(discOpts as Record<string, unknown>);
  return discussionsList(discOpts, actionLogger);
}
