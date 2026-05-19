/**
 * projects list subcommand
 *
 * List project items (excludes Done/Released by default).
 */
import { formatOutput, GH_PROJECTS_LIST_COLUMNS, } from "../../utils/formatters.js";
import { DEFAULT_EXCLUDE_STATUSES, getOwner, getProjectId, fetchAllItems, } from "./helpers.js";
/**
 * list subcommand
 */
export async function cmdList(options, logger) {
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
    const { title: projectTitle, items } = await fetchAllItems(projectId);
    // Apply status filter
    // Default: exclude Done/Released unless --all or --status specified
    let filteredItems = items;
    if (options.status && options.status.length > 0) {
        filteredItems = items.filter((i) => options.status.includes(i.status ?? ""));
    }
    else if (!options.all) {
        filteredItems = items.filter((i) => !DEFAULT_EXCLUDE_STATUSES.includes(i.status ?? ""));
    }
    const output = {
        project: { id: projectId, title: projectTitle, owner },
        items: filteredItems.map((i) => ({
            id: i.id,
            title: i.title,
            status: i.status,
            priority: i.priority,
            size: i.size,
            issue_number: i.issueNumber,
        })),
        total_count: filteredItems.length,
    };
    const outputFormat = options.format ?? "table-json";
    const formatted = formatOutput(output, outputFormat, {
        arrayKey: "items",
        columns: GH_PROJECTS_LIST_COLUMNS,
    });
    console.log(formatted);
    return 0;
}
//# sourceMappingURL=list.js.map