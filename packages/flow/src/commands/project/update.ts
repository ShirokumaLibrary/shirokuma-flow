/**
 * projects update subcommand
 *
 * Project フィールド（Status/Priority/Size）を更新する。
 * `items projects update` として公開されており、Issue 番号（#N または N）または
 * Project アイテム ID（PVTI_xxx）を受け取る。
 *
 * Issue 番号経由でプロジェクトフィールドを更新できる唯一の手段。
 * `items list` / `items show` では読み取りのみであり更新はできない。
 *
 * @example
 *   shirokuma-flow items projects update 42 --field-status "In Progress" --size M
 *   shirokuma-flow items projects update PVTI_xxx --field-status "Done"
 */

import { Logger } from "../../utils/logger.js";
import { validateBody } from "../../utils/github.js";
import { setFieldsWithStatusRouting } from "../../utils/issue-detail.js";
import {
  ProjectsOptions,
  runGraphQL,
  getOwner,
  getRepoName,
  isIssueNumber,
  parseIssueNumber,
  getProjectId,
  fetchItem,
  findItemByIssueNumber,
  getIssueByNumber,
  buildFieldsDict,
  GRAPHQL_MUTATION_UPDATE_BODY,
  GRAPHQL_MUTATION_UPDATE_ISSUE,
} from "./helpers.js";

/**
 * update subcommand
 */
export async function cmdUpdate(
  itemIdOrNumber: string,
  options: ProjectsOptions,
  logger: Logger
): Promise<number> {
  // Validation
  const bodyError = validateBody(options.bodyFile);
  if (bodyError) {
    logger.error(bodyError);
    return 1;
  }

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

  let item = await fetchItem(itemId);
  if (!item) {
    logger.error(`Item '${itemIdOrNumber}' not found`);
    return 1;
  }

  const projectId = item.project?.id;
  if (!projectId) {
    logger.error("Could not determine project ID");
    return 1;
  }

  // Build fields dict from options
  const fields = buildFieldsDict(options);

  // ADR-v3-014 / FIX-2 (#2156): `projects update` は Project Item ID ベースで Issue 番号が不明のため
  // `previousStatus: undefined` を明示的に渡す（G12 後退クリアの対象外）。
  // Status 遷移バリデーションは本経路では作動しない（手動操作ツールの責務外）。
  const { Status: statusValue, ...nonStatusFields } = fields;
  const { fieldsUpdated, statusUpdated } = await setFieldsWithStatusRouting({
    projectId,
    itemId,
    nonStatusFields,
    statusValue,
    logger,
    previousStatus: undefined,
  });
  let updated = fieldsUpdated || statusUpdated;

  // Update body if provided
  if (options.bodyFile !== undefined) {
    if (item.draftIssueId) {
      // DraftIssue body update
      const result = await runGraphQL(GRAPHQL_MUTATION_UPDATE_BODY, {
        draftIssueId: item.draftIssueId,
        body: options.bodyFile,
      });
      if (result.success) updated = true;
    } else if (item.issueNumber && owner && repo) {
      // Issue body update
      const issueData = await getIssueByNumber(owner, repo, item.issueNumber);
      if (issueData?.id) {
        const result = await runGraphQL(GRAPHQL_MUTATION_UPDATE_ISSUE, {
          id: issueData.id,
          body: options.bodyFile,
        });
        if (result.success) updated = true;
      } else {
        logger.warn("Cannot update Issue body (Issue not found)");
      }
    } else {
      logger.warn("Cannot update body (unknown content type)");
    }
  }

  if (updated) {
    item = await fetchItem(itemId);
  }

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
