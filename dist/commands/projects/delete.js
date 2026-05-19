/**
 * projects delete subcommand
 *
 * Delete item from project.
 */
import { GRAPHQL_MUTATION_DELETE_ITEM } from "../../utils/graphql-queries.js";
import { runGraphQL, getOwner, getRepoName, isIssueNumber, parseIssueNumber, getProjectId, fetchItem, findItemByIssueNumber, } from "./helpers.js";
/**
 * delete subcommand
 */
export async function cmdDelete(itemIdOrNumber, options, logger) {
    let itemId = itemIdOrNumber;
    const owner = options.owner || getOwner();
    const repo = getRepoName();
    // Support #number notation
    if (isIssueNumber(itemIdOrNumber)) {
        const issueNumber = parseIssueNumber(itemIdOrNumber);
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
    const projectId = item.project?.id;
    if (!projectId) {
        logger.error("Could not determine project ID");
        return 1;
    }
    const title = item.title ?? "Unknown";
    const issueNum = item.issueNumber;
    // Confirmation prompt (unless --force)
    if (!options.force) {
        const displayName = issueNum ? `#${issueNum} ${title}` : title;
        console.error(`About to remove from project: ${displayName}`);
        if (issueNum) {
            console.error("  Note: The Issue will NOT be deleted, only removed from project.");
        }
        // In Node.js we can't easily do interactive prompts in a portable way
        // For now, require --force flag
        logger.error("Use --force to confirm deletion");
        return 1;
    }
    // Delete from project
    const result = await runGraphQL(GRAPHQL_MUTATION_DELETE_ITEM, { projectId, itemId });
    if (result.success) {
        const output = {
            deleted: true,
            item_id: itemId,
            title,
        };
        if (issueNum) {
            output.issue_number = issueNum;
            output.note = "Item removed from project. Issue still exists.";
        }
        console.log(JSON.stringify(output, null, 2));
        return 0;
    }
    else {
        logger.error("Failed to delete item");
        return 1;
    }
}
//# sourceMappingURL=delete.js.map