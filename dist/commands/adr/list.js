/**
 * adr list - List ADR Discussions
 */
import { createActionLogger } from "../../utils/cli-helpers.js";
import { cmdList as discussionsList } from "../discussions/list.js";
import { ADR_CATEGORY } from "./create.js";
/**
 * list subcommand handler
 */
export async function cmdList(options) {
    const discOpts = {
        category: ADR_CATEGORY,
        limit: options.limit,
        verbose: options.verbose,
        repo: options.repo,
        public: options.public,
    };
    const actionLogger = createActionLogger(discOpts);
    return discussionsList(discOpts, actionLogger);
}
//# sourceMappingURL=list.js.map