/**
 * projects create subcommand
 *
 * Create a new draft issue in the project.
 */
import { validateTitle, validateBody, } from "../../utils/github.js";
import { setFieldsWithStatusRouting } from "../../utils/issue-detail.js";
import { runGraphQL, getOwner, getProjectId, fetchItem, buildFieldsDict, GRAPHQL_MUTATION_CREATE, } from "./helpers.js";
/**
 * create subcommand
 */
export async function cmdCreate(options, logger) {
    // Validation
    if (!options.title) {
        logger.error("--title is required");
        return 1;
    }
    const titleError = validateTitle(options.title);
    if (titleError) {
        logger.error(titleError);
        return 1;
    }
    const bodyError = validateBody(options.bodyFile);
    if (bodyError) {
        logger.error(bodyError);
        return 1;
    }
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
    const result = await runGraphQL(GRAPHQL_MUTATION_CREATE, {
        projectId,
        title: options.title,
        body: options.bodyFile ?? "",
    });
    if (!result.success) {
        logger.error("Failed to create item");
        return 1;
    }
    const itemId = result.data?.data?.addProjectV2DraftIssue?.projectItem?.id;
    if (!itemId) {
        logger.error("Failed to create item");
        return 1;
    }
    // Set fields if provided
    // Status は setFieldsWithStatusRouting 経由で updateProjectStatus を呼び出す（#2207）。
    // 新規作成のため previousStatus は undefined。
    const fields = buildFieldsDict(options);
    if (Object.keys(fields).length > 0) {
        const { Status: statusValue, ...nonStatusFields } = fields;
        await setFieldsWithStatusRouting({
            projectId,
            itemId,
            nonStatusFields,
            statusValue,
            logger,
            previousStatus: undefined,
        });
    }
    const item = await fetchItem(itemId);
    if (item) {
        const output = {
            id: item.id,
            title: item.title,
            status: item.status,
            priority: item.priority,
            size: item.size,
            issue_number: item.issueNumber,
            draft_issue_id: item.draftIssueId,
            project: item.project,
        };
        console.log(JSON.stringify(output, null, 2));
    }
    return 0;
}
//# sourceMappingURL=create.js.map