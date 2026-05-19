/**
 * projects fields subcommand
 *
 * Show available field options.
 */
import { getProjectFields } from "../../utils/project-fields.js";
import { getOwner, getProjectId, } from "./helpers.js";
/**
 * fields subcommand
 */
export async function cmdFields(options, logger) {
    const owner = options.owner || getOwner();
    if (!owner) {
        logger.error("Could not determine repository owner");
        return 1;
    }
    const projectId = await getProjectId(owner);
    if (!projectId) {
        logger.error(`No project found for owner '${owner}'`);
        return 1;
    }
    const fields = await getProjectFields(projectId);
    console.log(JSON.stringify(fields, null, 2));
    return 0;
}
//# sourceMappingURL=fields.js.map