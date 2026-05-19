/**
 * adr get - Get ADR Discussion details
 */
import { createActionLogger } from "../../utils/cli-helpers.js";
import { cmdGet as discussionsGet } from "../discussions/show.js";
/**
 * get subcommand handler
 */
export async function cmdGet(target, options) {
    const discOpts = {
        verbose: options.verbose,
        repo: options.repo,
        public: options.public,
    };
    const actionLogger = createActionLogger(discOpts);
    return discussionsGet(target, discOpts, actionLogger);
}
//# sourceMappingURL=get.js.map