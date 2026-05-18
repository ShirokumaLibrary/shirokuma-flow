/**
 * items remove サブコマンド (#1814)
 *
 * issues remove から移行。プロジェクトから Issue を削除する。
 */

import {
  runGraphQL,
  isIssueNumber,
  parseIssueNumber,
} from "../../../utils/github.js";
import { resolveTargetRepo } from "../../../utils/repo-pairs.js";
import {
  GRAPHQL_MUTATION_DELETE_ITEM,
} from "../../../utils/graphql-queries.js";
import { getProjectId } from "../../../utils/project-utils.js";
import { getIssueDetail } from "../../../utils/issue-detail.js";
import type { Logger } from "../../../utils/logger.js";
import type { RemoveOptions } from "../../items/types.js";

// =============================================================================
// Command
// =============================================================================

/**
 * items remove サブコマンド - プロジェクトから Issue を削除する。
 */
export async function cmdRemove(
  target: string,
  options: RemoveOptions,
  logger: Logger
): Promise<number> {
  if (!isIssueNumber(target)) {
    logger.error("Issue number required");
    return 1;
  }

  const issueNumber = parseIssueNumber(target);
  const repoInfo = resolveTargetRepo(options);
  if (!repoInfo) {
    logger.error("Could not determine repository");
    return 1;
  }

  const { owner, name: repo } = repoInfo;

  const projectId = await getProjectId(owner, repo);
  if (!projectId) {
    logger.error(`No project found for owner '${owner}'`);
    return 1;
  }

  const issueResult = await getIssueDetail(owner, repo, issueNumber);
  if (!issueResult) {
    logger.error(`Issue #${issueNumber} not found`);
    return 1;
  }

  const projectItemId = issueResult.projectItemId;
  if (!projectItemId) {
    logger.error(`Issue #${issueNumber} is not in any project`);
    return 1;
  }

  const result = await runGraphQL(GRAPHQL_MUTATION_DELETE_ITEM, {
    projectId,
    itemId: projectItemId,
  });

  if (result.success) {
    const output = {
      removed: true,
      issue_number: issueNumber,
      note: "Issue removed from project. Issue still exists.",
    };
    console.log(JSON.stringify(output, null, 2));
    return 0;
  } else {
    logger.error(`Failed to remove Issue #${issueNumber} from project`);
    return 1;
  }
}
