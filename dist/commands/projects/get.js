/**
 * projects get subcommand
 *
 * Get item details by ID or issue number.
 */
import { getOwner, getRepoName, isIssueNumber, parseIssueNumber, getProjectId, fetchItem, findItemByIssueNumber, } from "./helpers.js";
/**
 * get subcommand
 */
export async function cmdGet(itemIdOrNumber, options, logger) {
    let itemId = itemIdOrNumber;
    // Support #number notation
    if (isIssueNumber(itemIdOrNumber)) {
        const issueNumber = parseIssueNumber(itemIdOrNumber);
        const owner = options.owner || getOwner();
        const repo = getRepoName();
        if (!owner || !repo) {
            logger.error("Could not determine repository");
            return 1;
        }
        const projectId = await getProjectId(owner);
        if (!projectId) {
            logger.error(`No project found for owner '${owner}'`);
            return 1;
        }
        const found = await findItemByIssueNumber(projectId, issueNumber);
        if (!found) {
            logger.error(`No project item found for Issue #${issueNumber}`);
            return 1;
        }
        itemId = found.id;
    }
    const item = await fetchItem(itemId);
    if (!item) {
        logger.error(`Item '${itemIdOrNumber}' not found`);
        return 1;
    }
    // Convert to snake_case for JSON output (consistency with Python version)
    const output = {
        id: item.id,
        title: item.title,
        body: item.body,
        status: item.status,
        status_option_id: item.statusOptionId,
        priority: item.priority,
        priority_option_id: item.priorityOptionId,
        size: item.size,
        size_option_id: item.sizeOptionId,
        issue_number: item.issueNumber,
        issue_url: item.issueUrl,
        draft_issue_id: item.draftIssueId,
        project: item.project,
    };
    console.log(JSON.stringify(output, null, 2));
    return 0;
}
//# sourceMappingURL=get.js.map