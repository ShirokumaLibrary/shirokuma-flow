/**
 * projects add-issue subcommand
 *
 * Add existing issue to project.
 */
import { GRAPHQL_MUTATION_ADD_TO_PROJECT } from "../../utils/project-fields.js";
import { setFieldsWithStatusRouting } from "../../utils/issue-detail.js";
import { runGraphQL, getOwner, getRepoName, parseIssueNumber, getProjectId, fetchItem, findItemByIssueNumber, getIssueByNumber, buildFieldsDict, } from "./helpers.js";
/**
 * add-issue subcommand
 */
export async function cmdAddIssue(issueNumberStr, options, logger) {
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
    const issueNumber = parseIssueNumber(issueNumberStr);
    // Get Issue details
    const issue = await getIssueByNumber(owner, repo, issueNumber);
    if (!issue) {
        logger.error(`Issue #${issueNumber} not found`);
        return 1;
    }
    // Check if already in project
    const existing = await findItemByIssueNumber(projectId, issueNumber);
    if (existing) {
        logger.info(`Issue #${issueNumber} is already in the project`);
        const item = await fetchItem(existing.id);
        if (item) {
            const output = {
                id: item.id,
                title: item.title,
                status: item.status,
                priority: item.priority,
                size: item.size,
                issue_number: item.issueNumber,
                issue_url: item.issueUrl,
            };
            console.log(JSON.stringify(output, null, 2));
        }
        return 0;
    }
    const result = await runGraphQL(GRAPHQL_MUTATION_ADD_TO_PROJECT, {
        projectId,
        contentId: issue.id,
    });
    if (!result.success) {
        logger.error(`Failed to add Issue #${issueNumber} to project`);
        return 1;
    }
    const itemId = result.data?.data?.addProjectV2ItemById?.item?.id;
    if (!itemId) {
        logger.error(`Failed to add Issue #${issueNumber} to project`);
        return 1;
    }
    // Set project fields
    // ADR-v3-014 / FIX-3 (#2158): Status は `autoSetTimestamps` を発動させるため `updateProjectStatus` 経由で設定する。
    // 新規追加のため `previousStatus: undefined`（Backlog / Pending 等のマッピング対象外ステータスは
    // `autoSetTimestamps` 内でサイレントスキップされる）。重複パターンを setFieldsWithStatusRouting に集約 (#2173)。
    const fields = buildFieldsDict(options);
    const { Status: statusValue, ...nonStatusFields } = fields;
    await setFieldsWithStatusRouting({
        projectId,
        itemId,
        nonStatusFields,
        statusValue,
        logger,
        previousStatus: undefined,
    });
    const item = await fetchItem(itemId);
    if (item) {
        const output = {
            id: item.id,
            title: item.title,
            status: item.status,
            priority: item.priority,
            size: item.size,
            issue_number: item.issueNumber,
            issue_url: item.issueUrl,
        };
        console.log(JSON.stringify(output, null, 2));
    }
    return 0;
}
//# sourceMappingURL=add-issue.js.map